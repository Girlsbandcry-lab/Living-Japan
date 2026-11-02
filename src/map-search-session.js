const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase().trim();
const inBounds = (point, bounds) => point && (!bounds || point.x >= bounds[0] && point.x <= bounds[2] && point.y >= bounds[1] && point.y <= bounds[3]);

// LJ-MAP-SEARCH-SESSION-20261101: early nearby rows keep their published prefix while one scan fills complete cached pages.
export function createMapSearchSession({ scan, formatItem = item => item, positionOf = item => ({ point: item.coordinates, kind: item.coordinates ? 'point' : 'unlocated' }), onUpdate = () => {} }) {
  let sequence = 0;
  const jobs = new Map(), current = new Map(), completed = new Map();
  const counts = { scanStarts: 0, scanCompleted: 0, activeCancels: 0, cacheReuses: 0, pageRequests: 0, firstBatches: 0, rowsScanned: 0 };
  function order(job, keepPreview = false) {
    const bounds = job.priorityBounds, center = bounds ? [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2] : [0, 0];
    const prefix = keepPreview ? job.previewOrder : [], fixed = new Set(prefix), keys = []; job.near = 0;
    job.items.forEach((item, index) => {
      const point = job.positions[index].point, near = Boolean(bounds && inBounds(point, bounds)); if (near) job.near++;
      if (!fixed.has(index)) keys.push({ index, band: near ? 0 : point ? 1 : 2, distance: point ? (point.x - center[0]) ** 2 + (point.y - center[1]) ** 2 : Infinity });
    });
    keys.sort((a, b) => a.band - b.band || a.distance - b.distance || a.index - b.index); job.order = [...prefix, ...keys.map(row => row.index)];
  }
  function snapshot(job, page = 0, pageSize = job.pageSize) {
    const size = Math.max(1, Math.min(80, Number(pageSize) || 40)), total = job.complete ? job.items.length : null;
    const pages = job.complete ? Math.max(1, Math.ceil(total / size)) : null, currentPage = job.complete ? Math.max(0, Math.min(pages - 1, Number(page) || 0)) : 0;
    const visibleOrder = job.complete ? job.order : job.previewOrder;
    return { queryId: job.queryId, requestVersion: job.requestVersion, query: job.query, region: job.regionCode, complete: job.complete, phase: job.phase, total, matchedSoFar: job.items.length,
      near: job.near, located: job.located, outside: job.located - job.near, unlocated: job.unlocated, boundaryCount: job.boundaryCount, displayAnchorCount: job.displayAnchorCount, page: currentPage, pages, pageSize: size,
      items: visibleOrder.slice(currentPage * size, (currentPage + 1) * size).map(index => formatItem(job.items[index])), regionCounts: { ...job.regionCounts }, sourceCounts: { ...job.sourceCounts },
      scanned: job.scanned, scanMs: job.scanMs, firstResultMs: job.firstResultMs, priorityMs: job.priorityMs, priorityBounds: job.priorityBounds, reusedCache: Boolean(job.reusedCache), canonicalOnly: false,
      sourceCoverage: 'canonical+existing-administrative-district-personal-supplements', counts: { ...counts } };
  }
  function addPreview(job, index) {
    if (job.priorityBounds && inBounds(job.positions[index].point, job.priorityBounds) && job.previewOrder.length < Math.min(40, job.pageSize) && !job.previewOrder.includes(index)) job.previewOrder.push(index);
  }
  function add(job, item) {
    const position = positionOf(item), existing = job.ids.get(item.id);
    if (existing !== undefined) {
      if (!job.positions[existing].point && position.point && job.positions[existing].kind !== 'boundary') {
        const previous = job.items[existing];
        previous.coordinates = item.coordinates;
        if (previous.entity) previous.entity = { ...previous.entity, coordinates: item.coordinates, displayAnchorCoordinates: item.entity?.displayAnchorCoordinates || item.displayAnchorCoordinates };
        job.positions[existing] = position; job.located++; job.unlocated--;
        job.near += Boolean(job.priorityBounds && inBounds(position.point, job.priorityBounds)); job.displayAnchorCount += position.kind === 'display-anchor';
        addPreview(job, existing);
      }
      return;
    }
    job.ids.set(item.id, job.items.length); job.items.push(item); job.positions.push(position);
    job.located += Boolean(position.point); job.near += Boolean(job.priorityBounds && inBounds(position.point, job.priorityBounds));
    job.unlocated += position.kind === 'unlocated'; job.boundaryCount += position.kind === 'boundary'; job.displayAnchorCount += position.kind === 'display-anchor';
    const code = item.regionCode || item.entity?.regionCode || '00', source = item.searchSource || 'canonical';
    job.regionCounts[code] = (job.regionCounts[code] || 0) + 1; job.sourceCounts[source] = (job.sourceCounts[source] || 0) + 1;
    addPreview(job, job.items.length - 1);
  }
  function emit(job, type, result) {
    if (type === 'first' && !job.sentFirst) { job.sentFirst = true; counts.firstBatches++; }
    if ((type === 'first' || type === 'complete') && result.items.length && job.firstResultMs === null) job.firstResultMs = performance.now() - job.started;
    if (result.items) { result.firstResultMs = job.firstResultMs; result.counts = { ...counts }; }
    onUpdate({ queryId: job.queryId, requestScope: job.requestScope, requestVersion: job.requestVersion, type, result, counts: { ...counts } });
  }
  function publishPreview(job, force = false) {
    if (!job.previewOrder.length || job.previewOrder.length === job.publishedPreviewCount || !force && job.publishedPreviewCount && performance.now() - job.lastPreviewAt < 150) return false;
    job.publishedPreviewCount = job.previewOrder.length; job.lastPreviewAt = performance.now(); emit(job, 'first', snapshot(job)); return true;
  }
  function cancel(scope) {
    const job = current.get(scope);
    if (job && !job.complete && !job.controller.signal.aborted) { job.controller.abort(); counts.activeCancels++; }
  }
  function start(query, { regionCode = 'metro', priorityBounds = null, requestScope = 'map-search', requestVersion = 0, pageSize = 40, supplemental = [], supplementalSignature = '', entityIds, excludedIds = [] } = {}) {
    cancel(requestScope);
    const previous = current.get(requestScope); if (previous) jobs.delete(previous.queryId);
    const allowedIds = Array.isArray(entityIds) ? [...new Set(entityIds)].sort() : undefined;
    const key = JSON.stringify([normalize(query), regionCode, supplementalSignature, allowedIds, excludedIds]), cached = completed.get(requestScope);
    const job = { queryId: `map-search:${++sequence}`, requestScope, requestVersion, query: String(query).trim(), regionCode, entityIds: allowedIds, priorityBounds: priorityBounds ? [...priorityBounds] : null,
      pageSize, controller: new AbortController(), complete: false, phase: 'priority', items: [], positions: [], ids: new Map(), order: [], previewOrder: [], publishedPreviewCount: 0, lastPreviewAt: 0, sentFirst: false,
      near: 0, located: 0, unlocated: 0, boundaryCount: 0, displayAnchorCount: 0, regionCounts: {}, sourceCounts: {}, scanned: 0, scanMs: null, firstResultMs: null, priorityMs: null, started: performance.now() };
    jobs.set(job.queryId, job); current.set(requestScope, job);
    if (cached?.key === key) {
      Object.assign(job, { items: cached.items, positions: cached.positions, located: cached.located, unlocated: cached.unlocated, boundaryCount: cached.boundaryCount, displayAnchorCount: cached.displayAnchorCount,
        regionCounts: cached.regionCounts, sourceCounts: cached.sourceCounts, scanned: cached.scanned, scanMs: cached.scanMs, complete: true, phase: 'complete', reusedCache: true });
      counts.cacheReuses++; order(job); completed.set(requestScope, { ...job, key });
      queueMicrotask(() => { if (!job.controller.signal.aborted) emit(job, 'complete', snapshot(job)); });
      return { queryId: job.queryId, requestVersion };
    }
    for (const item of supplemental) add(job, item);
    counts.scanStarts++; emit(job, 'started', { query: job.query, region: regionCode, complete: false, total: null });
    const started = performance.now(); job.started = started; publishPreview(job);
    Promise.resolve().then(async () => {
      let lastScanned = 0;
      const recordScanned = scanned => { job.scanned = scanned; counts.rowsScanned += scanned - lastScanned; lastScanned = scanned; };
      try {
        const result = await scan(job.query, { regionCode, entityIds: job.entityIds, ...(excludedIds.length ? { excludedIds } : {}), priorityBounds: job.priorityBounds, signal: job.controller.signal,
          onBatch(batch, progress) {
            if (progress) recordScanned(progress.scanned);
            for (const item of batch) add(job, item);
            publishPreview(job);
          },
          onProgress(progress) {
            recordScanned(progress.scanned); publishPreview(job);
            emit(job, 'progress', { scanned: job.scanned, matched: job.items.length, near: job.near, located: job.located, outside: job.located - job.near,
              unlocated: job.unlocated, boundaryCount: job.boundaryCount, regionCounts: { ...job.regionCounts }, phase: job.phase, complete: false, total: null });
          },
          onPhase(phase) {
            if (phase.phase !== 'priority') return;
            recordScanned(phase.scanned); job.priorityMs = performance.now() - started; job.phase = 'remainder';
            if (!publishPreview(job, true)) emit(job, 'first', snapshot(job));
          },
        });
        if (job.controller.signal.aborted) throw new DOMException('Search superseded', 'AbortError');
        recordScanned(result.scanned); job.scanMs = performance.now() - started; job.complete = true; job.phase = 'complete'; job.ids.clear();
        order(job, true); counts.scanCompleted++; completed.set(requestScope, { ...job, key }); emit(job, 'complete', snapshot(job));
      } catch (error) { job.phase = error.name === 'AbortError' ? 'cancelled' : 'error'; emit(job, error.name === 'AbortError' ? 'aborted' : 'error', { message: error.name === 'AbortError' ? '旧查询已停止' : error.message }); }
    });
    return { queryId: job.queryId, requestVersion };
  }
  return { start, cancel,
    page(queryId, options = {}) { const job = jobs.get(queryId); if (!job) throw new Error('此查询已被新的搜索替换'); counts.pageRequests++; return snapshot(job, options.page, options.pageSize); },
    stats: () => ({ ...counts }),
    clear() { for (const scope of current.keys()) cancel(scope); jobs.clear(); current.clear(); completed.clear(); },
  };
}
