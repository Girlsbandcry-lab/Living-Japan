import { packJsonBytes, packSha256, packBase64, checkPackBytes, decodePackBundle, unpackBase64, createPackResourceFetcher } from './region-pack-resources.js';
export { createPackResourceFetcher } from './region-pack-resources.js';

// LJ-REGION-PACKS-20261101: verified shared blocks, independent installation records and unchanged personal saves.
const REGISTRY_NAME = 'living-japan-region-packs.json';
const REGISTRY_URL = '/user/files/' + REGISTRY_NAME;
const clone = value => structuredClone(value);
const emptyRegistry = () => ({ schemaVersion: 1, setupComplete: false, packages: {}, chunks: {} });
const abort = signal => { if (signal?.aborted) throw new DOMException('Aborted', 'AbortError'); };
const chunkName = hash => `living-japan-pack-${hash}.json.gz`;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const contentChanged = (before, after) => !before || (before.contentSha256 && after.contentSha256 ? before.contentSha256 !== after.contentSha256 : before.version !== after.version);
const publicPack = entry => entry.id !== 'common' && !entry.internal && !entry.hidden;
function validateManifest(value, id, version) {
  if (value?.schemaVersion !== 1 || value.id !== id || value.version !== version || !Array.isArray(value.chunks) || !Array.isArray(value.dependencies) || !object(value.files)) throw new Error('地区包清单无效：' + id);
  const chunks = new Map(value.chunks.map(chunk => [chunk.id, chunk]));
  if (chunks.size !== value.chunks.length || value.chunks.some(c => !Number.isSafeInteger(c.bytes) || c.bytes < 0 || !/^[a-f0-9]{64}$/.test(c.sha256) || typeof c.url !== 'string')) throw new Error('地区内容块清单无效：' + id);
  for (const file of Object.values(value.files)) if (!chunks.has(file.chunkId) || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('地区文件清单无效：' + id);
  return value;
}

export function createRegionPackManager({ sourceUrl, fetcher = globalThis.fetch, requestHeaders = () => ({}) } = {}) {
  let registry = emptyRegistry(), loaded = false, catalog = null, operation = null, controller = null, busy = false, resourceReader = null;
  // LJ-BODY-INTERNAL-UPDATE-20261102: lightweight update checks never download content or write personal saves.
  const listeners = new Set(), updateListeners = new Set(), verifiedLocalChunks = new Set();
  let checking = false, checkedAt = null, checkError = null, catalogCheck = null, lastUpdateSignature = '';
  function getUpdateSummary() {
    const entries = new Map((catalog?.packages || []).map(entry => [entry.id, entry]));
    const downloads = {}, items = [];
    for (const entry of entries.values()) {
      if (!publicPack(entry)) continue;
      const seen = new Set(), blocks = new Map(), changes = new Set(); let knownSize = true;
      function visit(id) {
        if (seen.has(id)) return; seen.add(id);
        const current = entries.get(id), before = registry.packages[id]?.installed?.manifest;
        if (!current) { knownSize = false; return; }
        if (contentChanged(before, current)) {
          let named = false;
          for (const key of ['places', 'indexes']) {
            const oldPart = before?.components?.[key], nextPart = current.components?.[key];
            if (nextPart && (!oldPart || (oldPart.sha256 && nextPart.sha256 ? oldPart.sha256 !== nextPart.sha256 : oldPart.version !== nextPart.version))) { changes.add(key); named = true; }
          }
          if (!named) changes.add('package');
        }
        if (!Array.isArray(current.chunks)) knownSize = false;
        else for (const chunk of current.chunks) blocks.set(chunk.sha256, chunk);
        current.dependencies.forEach(visit);
      }
      visit(entry.id);
      downloads[entry.id] = knownSize ? [...blocks.values()].reduce((sum, chunk) => {
        const saved = registry.chunks[chunk.sha256];
        return sum + (saved?.bytes === chunk.bytes && (saved.verified !== false || verifiedLocalChunks.has(chunk.sha256)) ? 0 : chunk.bytes);
      }, 0) : null;
      if (registry.packages[entry.id]?.installed && changes.size) items.push({ id: entry.id, name: entry.name || entry.id, version: entry.version, changes: [...changes], downloadBytes: downloads[entry.id] });
    }
    return clone({ checking, checkedAt, error: checkError, available: items.length > 0, items, downloads, notice: catalog?.notice || '', changelog: catalog?.changelog || [] });
  }
  const headers = () => ({ 'Content-Type': 'application/json', ...(typeof requestHeaders === 'function' ? requestHeaders() : requestHeaders) });
  // LJ-REQUIRED-METRO-20261102: readiness uses installed blocks; downloading an optional region does not activate it.
  function packageAvailability(source = registry) {
    const valid = new Map(), visiting = new Set();
    return function usable(id) {
      if (valid.has(id)) return valid.get(id);
      if (visiting.has(id)) return false;
      const manifest = source.packages[id]?.installed?.manifest;
      if (!manifest) return false;
      visiting.add(id);
      const okay = manifest.chunks.every(c => source.chunks[c.sha256]?.bytes === c.bytes && source.chunks[c.sha256].verified !== false) && manifest.dependencies.every(usable);
      visiting.delete(id); valid.set(id, okay); return okay;
    };
  }
  function activePackageIds(source = registry) {
    const active = new Set(), usable = packageAvailability(source);
    function include(id) { if (active.has(id)) return; source.packages[id].installed.manifest.dependencies.forEach(include); active.add(id); }
    for (const [id, value] of Object.entries(source.packages)) if (publicPack(catalog?.packages.find(p => p.id === id) || {id}) && value.enabled && usable(id)) include(id);
    return active;
  }
  const getState = () => {
    const usable = packageAvailability(), ready = Boolean(loaded && registry.packages.metro?.enabled && usable('metro'));
    return clone({
    loaded, sourceUrl: sourceUrl || null, catalog, ready, setupComplete: ready,
    packages: Object.fromEntries(Object.entries(registry.packages).map(([id, item]) => [id, {
      enabled: item.enabled, usable: usable(id),
      ...Object.fromEntries(['installed', 'pending'].filter(key => item[key]).map(key => [key, { version: item[key].version, manifestUrl: item[key].manifestUrl, bytes: item[key].manifest.chunks.reduce((sum, chunk) => sum + chunk.bytes, 0) }])),
    }])), operation, updates: getUpdateSummary(),
    });
  };
  const emit = () => {
    const state = getState();
    for (const fn of listeners) { try { fn(state); } catch (error) { console.error('[Living Japan] 地区包状态订阅失败', error); } }
    const signature = JSON.stringify(state.updates);
    if (signature !== lastUpdateSignature) {
      lastUpdateSignature = signature;
      for (const fn of updateListeners) { try { fn(clone(state.updates)); } catch (error) { console.error('[Living Japan] 更新状态订阅失败', error); } }
    }
  };
  const progress = values => { operation = { ...operation, ...values }; emit(); };
  function requireLoaded() { if (!loaded) throw new Error('请先成功读取地区安装记录'); }
  async function upload(name, bytes) {
    const response = await fetcher('/api/files/upload', { method: 'POST', credentials: 'same-origin', headers: headers(), body: JSON.stringify({ name, data: packBase64(bytes) }) });
    if (!response.ok) throw new Error(`地区文件保存失败（${response.status}）`);
    const result = await response.json(), expected = '/user/files/' + name;
    if (typeof result.path !== 'string' || '/' + result.path.replace(/^\//, '') !== expected) throw new Error('服务器未确认地区文件保存地址');
    return expected;
  }
  async function readBytes(url) {
    const response = await fetcher(url, { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error(`地区文件读回失败（${response.status}）`);
    return new Uint8Array(await response.arrayBuffer());
  }
  async function persist(next) {
    const bytes = packJsonBytes(next);
    if (controller) progress({ phase: 'saving' });
    await upload(REGISTRY_NAME, bytes);
    if (controller) progress({ phase: 'verifying' });
    await checkPackBytes(await readBytes(REGISTRY_URL), { bytes: bytes.byteLength, sha256: await packSha256(bytes) });
    registry = next; resourceReader?.clear(); resourceReader = null; emit();
  }
  async function load() {
    if (busy) throw new Error('地区包操作进行中');
    loaded = false;
    const response = await fetcher(REGISTRY_URL, { cache: 'no-store', credentials: 'same-origin' });
    if (response.status === 404) registry = emptyRegistry();
    else {
      if (!response.ok) throw new Error(`地区安装记录读取失败（${response.status}）`);
      try {
        const value = await response.json();
        if (value.schemaVersion !== 1 || !object(value.packages) || !object(value.chunks)) throw new Error('格式无效');
        for (const [hash, chunk] of Object.entries(value.chunks)) if (!/^[a-f0-9]{64}$/.test(hash) || chunk.sha256 !== hash || chunk.url !== '/user/files/' + chunkName(hash) || !Number.isSafeInteger(chunk.bytes) || chunk.bytes < 0) throw new Error('内容块保存记录无效');
        for (const [id, item] of Object.entries(value.packages)) for (const record of [item.installed, item.pending].filter(Boolean)) validateManifest(record.manifest, id, record.version);
        value.setupComplete = Boolean(value.setupComplete || value.packages.metro?.installed);
        registry = value;
      } catch (error) { loaded = false; throw new Error('地区安装记录损坏或格式不支持：' + error.message); }
    }
    loaded = true; resourceReader?.clear(); resourceReader = null; emit(); return getState();
  }
  function refreshCatalog() {
    if (catalogCheck) return catalogCheck;
    checking = true; checkError = null; emit();
    catalogCheck = Promise.resolve().then(async () => {
      try {
        if (!sourceUrl) throw new Error('地区下载源尚未配置');
        const response = await fetcher(sourceUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error(`地区下载目录读取失败（${response.status}）`);
        const value = await response.json();
        if (value.schemaVersion !== 1 || !Array.isArray(value.packages) || value.packages.some(p => !p.id || !p.version || !p.manifestUrl || !Array.isArray(p.dependencies) || (p.chunks !== undefined && (!Array.isArray(p.chunks) || p.chunks.some(c => !/^[a-f0-9]{64}$/.test(c.sha256) || !Number.isSafeInteger(c.bytes) || c.bytes < 0))))) throw new Error('地区下载目录格式无效');
        catalog = value;
        for (const [hash, chunk] of Object.entries(registry.chunks)) if (chunk.verified === false && !verifiedLocalChunks.has(hash)) {
          try { await checkPackBytes(await readBytes(chunk.url), chunk); verifiedLocalChunks.add(hash); } catch { /* An unfinished block still needs downloading. */ }
        }
        checkedAt = new Date().toISOString(); return clone(catalog);
      } catch (error) { checkError = error.message; throw error; }
      finally { checking = false; catalogCheck = null; emit(); }
    });
    return catalogCheck;
  }
  function getActiveSnapshot(source = registry) {
    const active = activePackageIds(source);
    const manifests = [], files = {}, chunks = {};
    for (const id of active) {
      const manifest = source.packages[id].installed.manifest; manifests.push(clone(manifest));
      const byId = new Map(manifest.chunks.map(c => [c.id, c]));
      for (const chunk of manifest.chunks) chunks[chunk.sha256] = clone(source.chunks[chunk.sha256]);
      for (const [path, file] of Object.entries(manifest.files)) {
        const chunk = byId.get(file.chunkId), stored = source.chunks[chunk.sha256];
        if (files[path] && files[path].sha256 !== file.sha256) throw new Error('已启用地区包包含不同的同路径资源：' + path);
        files[path] = { ...file, chunkId: chunk.sha256, url: stored.url };
      }
    }
    return { schemaVersion: 1, manifests, files, chunks, activePackIds: [...active] };
  }
  function installChangesActive(packId) {
    if (packId === 'metro' || registry.packages[packId]?.enabled) return true;
    const entries = new Map((catalog?.packages || []).map(entry => [entry.id, entry])), active = activePackageIds(), seen = new Set();
    function changes(id) {
      if (seen.has(id)) return false; seen.add(id);
      const entry = entries.get(id), before = registry.packages[id]?.installed?.manifest;
      if (!entry?.contentSha256 || !Array.isArray(entry.dependencies)) return true;
      if (active.has(id) && (!before?.contentSha256 || contentChanged(before, entry))) return true;
      return entry.dependencies.some(changes);
    }
    return changes(packId);
  }
  async function collectUnused() {
    const used = new Set(Object.values(registry.packages).flatMap(p => [p.installed, p.pending].filter(Boolean).flatMap(r => r.manifest.chunks.map(c => c.sha256))));
    const next = clone(registry); let changed = false;
    for (const [hash, chunk] of Object.entries(registry.chunks)) if (!used.has(hash)) {
      const response = await fetcher('/api/files/delete', { method: 'POST', credentials: 'same-origin', headers: headers(), body: JSON.stringify({ path: chunk.url.replace(/^\//, '') }) });
      if (!response.ok && response.status !== 404) throw new Error(`地区文件移除失败（${response.status}）`);
      delete next.chunks[hash]; changed = true;
    }
    if (changed) await persist(next);
  }
  async function download(chunk, manifestUrl, signal) {
    abort(signal);
    const response = await fetcher(new URL(chunk.url, manifestUrl).href, { signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`地区内容块下载失败（${response.status}）`);
    const reader = response.body?.getReader(), pieces = []; let size = 0;
    const before = operation.receivedBytes, downloadedBefore = operation.downloadedBytes;
    if (reader) {
      try { for (;;) { abort(signal); const part = await reader.read(); if (part.done) break; pieces.push(part.value); size += part.value.byteLength; progress({ phase: 'downloading', receivedBytes: before + size, downloadedBytes: downloadedBefore + size }); } }
      finally { reader.releaseLock(); }
    } else { const bytes = new Uint8Array(await response.arrayBuffer()); pieces.push(bytes); size = bytes.byteLength; progress({ phase: 'downloading', receivedBytes: before + size, downloadedBytes: downloadedBefore + size }); }
    const bytes = new Uint8Array(size); let at = 0; for (const piece of pieces) { bytes.set(piece, at); at += piece.byteLength; }
    abort(signal); await checkPackBytes(bytes, chunk); return bytes;
  }
  async function install(packId) {
    requireLoaded(); if (busy) throw new Error('已有地区包操作进行中');
    busy = true; controller = new AbortController(); const signal = controller.signal;
    operation = { packId, phase: 'preparing', receivedBytes: 0, downloadedBytes: 0, reusedBytes: 0, downloadTotalBytes: 0, totalBytes: 0, completedBlocks: 0, totalBlocks: 0, error: null }; emit();
    try {
      if (!catalog) await refreshCatalog();
      const prepared = new Map(), visiting = new Set();
      async function prepare(id) {
        abort(signal); if (prepared.has(id)) return; if (visiting.has(id)) throw new Error('地区包依赖形成循环：' + id);
        const entry = catalog.packages.find(p => p.id === id); if (!entry) throw new Error('地区下载目录中没有：' + id);
        visiting.add(id);
        const manifestUrl = new URL(entry.manifestUrl, sourceUrl).href;
        const response = await fetcher(manifestUrl, { cache: 'no-store', signal });
        if (!response.ok) throw new Error(`地区包清单读取失败（${response.status}）`);
        const manifest = validateManifest(await response.json(), id, entry.version);
        for (const dependency of manifest.dependencies) await prepare(dependency);
        visiting.delete(id); prepared.set(id, { version: manifest.version, manifestUrl, manifest });
      }
      await prepare(packId);
      const blocks = new Map();
      for (const record of prepared.values()) {
        const byId = new Map(record.manifest.chunks.map(chunk => [chunk.id, chunk]));
        for (const chunk of byId.values()) if (!blocks.has(chunk.sha256)) blocks.set(chunk.sha256, { chunk, record, files: [] });
        for (const [path, file] of Object.entries(record.manifest.files)) blocks.get(byId.get(file.chunkId).sha256).files.push([path, file]);
      }
      const needsDownload = new Set([...blocks.values()].filter(({chunk}) => registry.chunks[chunk.sha256]?.bytes !== chunk.bytes || (registry.chunks[chunk.sha256].verified === false && !verifiedLocalChunks.has(chunk.sha256))).map(({chunk}) => chunk.sha256));
      progress({ totalBytes: [...blocks.values()].reduce((n, b) => n + b.chunk.bytes, 0), downloadTotalBytes: [...blocks.values()].reduce((n, b) => n + (needsDownload.has(b.chunk.sha256) ? b.chunk.bytes : 0), 0), totalBlocks: blocks.size });
      const previousChunks = new Set(Object.keys(registry.chunks));
      const next = clone(registry);
      for (const [id, record] of prepared) next.packages[id] = { ...next.packages[id], enabled: next.packages[id]?.enabled ?? false, pending: record };
      for (const { chunk } of blocks.values()) next.chunks[chunk.sha256] ||= { url: '/user/files/' + chunkName(chunk.sha256), bytes: chunk.bytes, sha256: chunk.sha256, verified: false };
      await persist(next);
      for (const { chunk, record, files } of blocks.values()) {
        abort(signal); let bytes = null;
        const existing = registry.chunks[chunk.sha256];
        if (existing && previousChunks.has(chunk.sha256)) {
          progress({ phase: 'verifying' });
          try { const saved = await readBytes(existing.url); await checkPackBytes(saved, chunk); bytes = saved; }
          catch { bytes = null; }
        }
        const reused = Boolean(bytes);
        if (reused) progress({ receivedBytes: operation.receivedBytes + bytes.byteLength, reusedBytes: operation.reusedBytes + bytes.byteLength, downloadTotalBytes: operation.downloadTotalBytes - (needsDownload.has(chunk.sha256) ? chunk.bytes : 0) });
        else {
          progress({ phase: 'downloading', downloadTotalBytes: operation.downloadTotalBytes + (needsDownload.has(chunk.sha256) ? 0 : chunk.bytes) }); bytes = await download(chunk, record.manifestUrl, signal);
        }
        const { bundle } = await decodePackBundle(bytes);
        for (const [path, file] of files) {
          if (!Object.hasOwn(bundle.files, path)) throw new Error('内容块缺少声明的地区资源：' + path);
          await checkPackBytes(unpackBase64(bundle.files[path]), file);
        }
        if (!reused) {
          abort(signal); progress({ phase: 'saving' });
          const url = await upload(chunkName(chunk.sha256), bytes);
          progress({ phase: 'verifying' }); await checkPackBytes(await readBytes(url), chunk);
        }
        registry.chunks[chunk.sha256] = { url: '/user/files/' + chunkName(chunk.sha256), bytes: chunk.bytes, sha256: chunk.sha256, verified: true };
        verifiedLocalChunks.add(chunk.sha256);
        progress({ completedBlocks: operation.completedBlocks + 1 });
      }
      abort(signal);
      const complete = clone(registry);
      for (const [id, record] of prepared) { complete.packages[id].installed = record; if (id === 'metro') complete.packages[id].enabled = true; delete complete.packages[id].pending; }
      if (complete.packages.metro?.installed) complete.setupComplete = true;
      getActiveSnapshot(complete);
      await persist(complete);
      // A cleanup failure does not undo a fully saved, usable version; removal can retry it.
      let cleanupError = null;
      try { await collectUnused(); } catch (error) { cleanupError = error.message; }
      progress({ phase: 'ready', cleanupError }); return getActiveSnapshot();
    } catch (error) { progress({ phase: error.name === 'AbortError' ? 'paused' : 'error', error: error.message }); throw error; }
    finally { busy = false; controller = null; }
  }
  function cancel(packId) { if (operation?.packId === packId && controller) controller.abort(); }
  async function setEnabled(packId, enabled) {
    requireLoaded(); if (busy) throw new Error('地区包操作进行中');
    if (packId === 'metro' && !enabled) throw new Error('首都圈是必需资料，不能停用');
    if (!registry.packages[packId]?.installed || (enabled && !packageAvailability()(packId))) throw new Error('该地区包尚未完整安装，请重新下载');
    busy = true;
    try { const next = clone(registry); next.packages[packId].enabled = Boolean(enabled); getActiveSnapshot(next); await persist(next); return getActiveSnapshot(); }
    finally { busy = false; }
  }
  async function remove(packId) {
    requireLoaded(); if (busy) throw new Error('地区包操作进行中');
    if (packId === 'metro') throw new Error('首都圈是必需资料，不能移除');
    busy = true;
    try {
      const next = clone(registry); delete next.packages[packId]; await persist(next);
      let cleanupError = null;
      try { await collectUnused(); } catch (error) { cleanupError = error.message; }
      operation = { packId, phase: 'ready', receivedBytes: 0, downloadedBytes: 0, reusedBytes: 0, totalBytes: 0, completedBlocks: 0, totalBlocks: 0, error: null, cleanupError };
      emit(); return getState();
    }
    finally { busy = false; }
  }
  async function readResource(path) {
    requireLoaded(); const baseUrl = new URL('../', import.meta.url).href;
    resourceReader ||= createPackResourceFetcher({ snapshot: getActiveSnapshot(), baseUrl, fetcher });
    return resourceReader(new URL(path, baseUrl));
  }
  return { load, refreshCatalog, getState, getUpdateSummary, installChangesActive, subscribeUpdates(fn) { updateListeners.add(fn); return () => updateListeners.delete(fn); }, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, install, cancel, setEnabled, remove, getActiveSnapshot, readResource };
}
