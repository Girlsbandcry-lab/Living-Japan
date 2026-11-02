import { normalizeSearchText as normalize, tokenizeSearchQuery } from './search-text.js';
const pageLength = value => Math.max(1, Math.min(500, Math.floor(Number(value) || 48)));

// Complete text results have their own ordering, cancellation and page cache.
export function createTextSearchSession({ scan, formatItem = item => item, onUpdate = () => {} }) {
  let sequence = 0;
  const jobs = new Map(), current = new Map(), completed = new Map();
  const counts = { scanStarts: 0, scanCompleted: 0, activeCancels: 0, cacheReuses: 0, pageRequests: 0, rowsScanned: 0 };
  const isCurrent = job => current.get(job.requestScope) === job && !job.controller.signal.aborted;
  function snapshot(job, page = 0, pageSize = job.pageSize) {
    const size = pageLength(pageSize), total = job.items.length, pages = Math.max(1, Math.ceil(total / size));
    const number = Math.max(0, Math.min(pages - 1, Math.floor(Number(page) || 0)));
    return { queryId: job.queryId, requestVersion: job.requestVersion, query: job.query, regionCode: job.regionCode,
      complete: true, total, page: number, pages, pageSize: size,
      items: job.items.slice(number * size, (number + 1) * size).map(item => formatItem(item)),
      scanned: job.scanned, reusedCache: Boolean(job.reusedCache) };
  }
  function emit(job, type, result) {
    if (isCurrent(job)) onUpdate({ queryId: job.queryId, requestScope: job.requestScope, requestVersion: job.requestVersion, type, result });
  }
  function cancel(scope = 'text-search') {
    const job = current.get(scope);
    if (job && !job.controller.signal.aborted) {
      job.controller.abort();
      if (!job.complete) counts.activeCancels++;
    }
  }
  function start(query, { regionCode = 'metro', requestScope = 'text-search', requestVersion = 0, pageSize = 48,
    entityIds, supplemental = [], supplementalSignature = '' } = {}) {
    cancel(requestScope);
    const previous = current.get(requestScope); if (previous) jobs.delete(previous.queryId);
    const allowedIds = Array.isArray(entityIds) ? [...new Set(entityIds)].sort() : undefined;
    const allowed = allowedIds && new Set(allowedIds);
    const key = JSON.stringify([tokenizeSearchQuery(query), regionCode, allowedIds, supplementalSignature || JSON.stringify(supplemental)]);
    const job = { queryId: `text-search:${++sequence}`, query: String(query || '').trim(), regionCode, requestScope, requestVersion,
      pageSize: pageLength(pageSize), controller: new AbortController(), items: [], scanned: 0, complete: false };
    jobs.set(job.queryId, job); current.set(requestScope, job);
    const cached = completed.get(requestScope);
    if (cached?.key === key) {
      Object.assign(job, { items: cached.items, scanned: cached.scanned, complete: true, reusedCache: true });
      counts.cacheReuses++;
      queueMicrotask(() => { if (isCurrent(job)) emit(job, 'complete', snapshot(job)); });
      return { queryId: job.queryId, requestVersion };
    }
    const matches = new Map();
    const add = item => { if (!matches.has(item.id)) matches.set(item.id, item); };
    for (const item of supplemental) if (!allowed || allowed.has(item.id)) add(item);
    const recordScanned = value => {
      const next = Math.max(job.scanned, Number(value) || 0);
      counts.rowsScanned += next - job.scanned; job.scanned = next;
    };
    Promise.resolve().then(async () => {
      if (!isCurrent(job)) return;
      counts.scanStarts++;
      try {
        const result = await scan(job.query, { regionCode, entityIds: allowedIds, signal: job.controller.signal,
          onBatch(batch, progress) {
            if (!isCurrent(job)) return;
            recordScanned(progress?.scanned);
            for (const item of batch) add(item);
          } });
        if (!isCurrent(job)) return;
        recordScanned(result?.scanned);
        const normalizedQuery = normalize(job.query), rank = name => name === normalizedQuery ? 0 : name.startsWith(normalizedQuery) ? 1 : 2;
        job.items = [...matches.values()].map(item => ({ item, name: normalize(item.name), id: String(item.id) }))
          .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, 'ja') || a.id.localeCompare(b.id, 'ja')).map(row => row.item);
        job.complete = true; counts.scanCompleted++;
        completed.set(requestScope, { key, items: job.items, scanned: job.scanned });
        emit(job, 'complete', snapshot(job));
      } catch (error) {
        if (error.name !== 'AbortError') emit(job, 'error', { message: error.message });
      }
    });
    return { queryId: job.queryId, requestVersion };
  }
  return { start, cancel,
    page(queryId, options = {}) {
      const job = jobs.get(queryId);
      if (!job || !job.complete && !isCurrent(job)) throw new Error('此查询已取消或被新的搜索替换');
      if (!job.complete) throw new Error('此查询尚未完成');
      counts.pageRequests++; return snapshot(job, options.page, options.pageSize);
    },
    stats: () => ({ ...counts }),
    clear() { for (const scope of current.keys()) cancel(scope); jobs.clear(); current.clear(); completed.clear(); },
  };
}
