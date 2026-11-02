// LJ-GEO-DIRECTORY: direct geographic edges drive browsing; identities and text stay separate.
export function createGeographicDirectory({ index, read, lookup = async () => null,
  supplements = async () => [], normalizeNode = value => value,
  rootId = 'navigation:root', unassignedId = 'browse:unassigned' }) {
  const parts = index.canonicalPlaces?.geographicIndex?.parts || [];
  const sources = new Map(), additional = new Map(), discovered = new Map();
  const nodes = new Map(), children = new Map(), parentRefs = new Map(), aliases = new Map();
  const reads = new Map(), regionReads = new Map(), lookups = new Map();
  let initialized = false, refreshPending, revision = 0, filterCache;
  const code = value => value == null ? '' : String(value);
  const idOf = value => typeof value === 'string' ? value : value?.id;
  const nameKey = value => String(value.name || value.label || value.nameJa || value.id).normalize('NFKC').toLocaleLowerCase();
  const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;

  function normalizeReference(value) {
    const ref = typeof value === 'string' ? { id: value } : value;
    if (!ref?.id) return null;
    const normalized = normalizeNode({ ...ref });
    if (!normalized?.id) return null;
    aliases.set(ref.id, normalized.id);
    return { id: normalized.id, ...(ref.regionCode ? { regionCode: code(ref.regionCode) } : {}) };
  }
  function canonicalId(id) {
    if (aliases.has(id)) return aliases.get(id);
    return normalizeReference({ id })?.id || null;
  }
  function normalize(value) {
    if (!value?.id) return null;
    const row = normalizeNode({ ...value });
    if (!row?.id) return null;
    aliases.set(value.id, row.id);
    const { body, ...metadata } = row;
    metadata.name ||= row.label || row.nameJa || row.id;
    metadata.adminNodeId ||= idOf(row.adminPath?.at(-1)) || null;
    if (row.regionCode != null) metadata.regionCode = code(row.regionCode);
    if (Array.isArray(row.parents)) metadata.parents = row.parents.map(normalizeReference).filter(Boolean);
    else if (row.parentId) metadata.parents = [normalizeReference(row.parentId)].filter(Boolean);
    return metadata;
  }
  function references(row) {
    if (row.id === rootId) return [];
    if (row.parents?.length) return row.parents;
    const parent = row.adminNodeId && row.adminNodeId !== row.id ? row.adminNodeId
      : row.isAdministrative || row.isNavigation || row.id === unassignedId ? rootId : unassignedId;
    return [{ id: parent }];
  }
  function sync(id) {
    for (const ref of parentRefs.get(id) || []) {
      children.get(ref.id)?.delete(id);
      if (!children.get(ref.id)?.size) children.delete(ref.id);
    }
    parentRefs.delete(id);
    const base = sources.get(id) || discovered.get(id), extra = additional.get(id);
    if (!base && !extra) { nodes.delete(id); revision++; return; }
    const row = { ...base, ...extra };
    nodes.set(id, row);
    const refs = [...new Map(references(row).filter(ref => ref.id !== id).map(ref => [ref.id, ref])).values()];
    parentRefs.set(id, refs);
    for (const ref of refs) {
      if (!children.has(ref.id)) children.set(ref.id, new Set());
      children.get(ref.id).add(id);
    }
    revision++;
  }
  function storeSource(raw) {
    const row = normalize(raw);
    if (!row) return;
    const previous = sources.get(row.id);
    const combined = { ...previous, ...row };
    if (previous?.parents?.length && row.parents?.length) combined.parents = [...new Map([...previous.parents, ...row.parents].map(ref => [ref.id, ref])).values()];
    sources.set(row.id, combined); sync(row.id);
  }
  async function refreshSupplements() {
    if (refreshPending) return refreshPending;
    refreshPending = (async () => {
      const values = await supplements();
      const affected = new Set([...additional.keys(), ...discovered.keys()]);
      additional.clear();
      discovered.clear();
      for (const raw of values || []) {
        const row = normalize(raw);
        if (!row) continue;
        additional.set(row.id, row); affected.add(row.id);
      }
      if (!additional.has(rootId)) { additional.set(rootId, { id: rootId, name: '地区', isNavigation: true, parents: [] }); affected.add(rootId); }
      for (const id of affected) sync(id);
      lookups.clear();
      initialized = true;
    })();
    try { await refreshPending; } finally { refreshPending = null; }
  }
  async function init() {
    if (!initialized) await refreshSupplements();
    if (refreshPending) await refreshPending;
  }
  async function loadRegion(regionCode) {
    const region = code(regionCode);
    if (!region || regionReads.has(region)) return regionReads.get(region);
    const pending = Promise.all(parts.filter(part => (part.regionCodes || []).map(code).includes(region)).map(part => {
      if (!reads.has(part.path)) reads.set(part.path, (async () => {
        const payload = await read(part.path);
        for (const row of payload.nodes || []) storeSource(row);
      })().catch(error => { reads.delete(part.path); throw error; }));
      return reads.get(part.path);
    }));
    regionReads.set(region, pending);
    try { await pending; } catch (error) { regionReads.delete(region); throw error; }
  }
  async function ensure(id, hint, expand = false) {
    await init();
    id = canonicalId(id);
    if (!id) return null;
    let row = nodes.get(id);
    if (hint?.regionCode && (!row || !row.isAdministrative && !row.isNavigation)) await loadRegion(hint.regionCode);
    row = nodes.get(id) || row;
    if (!row) {
      if (!lookups.has(id)) lookups.set(id, Promise.resolve(lookup(id)));
      const found = await lookups.get(id), normalized = normalize(found);
      if (normalized) {
        await loadRegion(normalized.regionCode);
        id = normalized.id;
        if (!nodes.has(id)) { discovered.set(id, normalized); sync(id); }
        row = nodes.get(id);
      }
    }
    if (row?.regionCode && ((!row.isAdministrative && !row.isNavigation) || expand && (!row.isNavigation || row.id === unassignedId))) await loadRegion(row.regionCode);
    row = nodes.get(id) || row;
    if (!row && id === unassignedId && children.has(id)) {
      additional.set(id, { id, name: '地区待确认', isAdministrative: true, parents: [{ id: rootId }] });
      sync(id); row = nodes.get(id);
    }
    return row || null;
  }
  function metadata(row) {
    if (!row) return null;
    const count = children.get(row.id)?.size || 0;
    const loaded = !row.regionCode || regionReads.has(code(row.regionCode));
    const childCount = loaded ? count : Math.max(count, Number(row.childCount) || 0);
    return { ...row, parents: (parentRefs.get(row.id) || []).map(ref => ({ ...ref })), childCount,
      hasChildren: childCount > 0 || !loaded && row.hasChildren === true };
  }
  function compare(a, b) {
    const rank = row => row.isAdministrative || row.isNavigation ? 0 : metadata(row).hasChildren ? 1 : 2;
    return rank(a) - rank(b) || compareText(nameKey(a), nameKey(b)) || compareText(a.id, b.id);
  }
  async function parents(id) {
    const row = await ensure(id);
    if (!row) return [];
    const values = await Promise.all((parentRefs.get(row.id) || []).map(ref => ensure(ref.id, ref)));
    return values.filter(Boolean).sort(compare).map(metadata);
  }
  async function allowed(entityIds) {
    if (!Array.isArray(entityIds)) return null;
    const key = JSON.stringify([...new Set(entityIds)].sort());
    if (filterCache?.key === key && filterCache.revision === revision) return filterCache.ids;
    const ids = new Set(), queue = entityIds.map(id => ({ id }));
    while (queue.length) {
      const ref = queue.pop(), id = canonicalId(ref.id);
      if (!id || ids.has(id)) continue;
      const row = await ensure(id, ref);
      if (!row) continue;
      ids.add(row.id);
      queue.push(...(parentRefs.get(row.id) || []));
    }
    filterCache = { key, revision, ids };
    return ids;
  }
  async function page(parentId, { offset = 0, limit = 48, entityIds, favoriteIds = [] } = {}) {
    const parent = await ensure(parentId, undefined, true);
    const included = await allowed(entityIds);
    offset = Math.max(0, Math.floor(Number(offset) || 0));
    limit = Math.max(1, Math.floor(Number(limit) || 48));
    const favorites = new Set(favoriteIds.map(canonicalId));
    const entries = parent ? [...(children.get(parent.id) || [])].map(id => nodes.get(id)).filter(row => row && (!included || included.has(row.id)))
      .sort((a, b) => Number(favorites.has(b.id)) - Number(favorites.has(a.id)) || compare(a, b)) : [];
    return { items: entries.slice(offset, offset + limit).map(metadata), total: entries.length, offset, hasMore: offset + limit < entries.length };
  }
  async function path(id, { pathIds = [] } = {}) {
    const preferred = pathIds.map(canonicalId).filter(value => value && value !== rootId);
    async function walk(current, prefix, seen) {
      if (current === rootId) return [];
      if (seen.has(current)) return null;
      const row = await ensure(current);
      if (!row) return null;
      const nextSeen = new Set([...seen, row.id]);
      const values = await parents(row.id), at = prefix.lastIndexOf(row.id);
      const wanted = at >= 0 ? prefix[at - 1] : prefix.at(-1);
      values.sort((a, b) => Number(b.id === wanted) - Number(a.id === wanted) || compare(a, b));
      for (const parent of values) {
        const upper = await walk(parent.id, at >= 0 ? prefix.slice(0, at) : prefix, nextSeen);
        if (upper) return [...upper, metadata(row)];
      }
      return null;
    }
    await init();
    return await walk(canonicalId(id), preferred, new Set()) || [];
  }
  async function locate(id, { pageSize = 48, entityIds, pathIds, favoriteIds = [] } = {}) {
    const row = await ensure(id), unavailable = { status: 'unavailable', parentId: null, offset: 0, pathIds: [], entryId: row?.id || id };
    if (!row) return unavailable;
    const included = await allowed(entityIds);
    if (included && !included.has(row.id)) return { ...unavailable, status: 'filtered' };
    const chain = await path(row.id, { pathIds });
    if (!chain.length) return unavailable;
    const container = chain.slice(0, -1), parentId = container.at(-1)?.id || rootId;
    const siblings = await page(parentId, { entityIds, favoriteIds, limit: Number.MAX_SAFE_INTEGER });
    const position = siblings.items.findIndex(item => item.id === row.id);
    if (position < 0) return { ...unavailable, status: included ? 'filtered' : 'unavailable' };
    const size = Math.max(1, Math.floor(Number(pageSize) || 48));
    return { status: 'found', parentId, offset: Math.floor(position / size) * size,
      pathIds: container.map(item => item.id), entryId: row.id };
  }
  return { page, parents, path, locate, node: async id => metadata(await ensure(id)), refreshSupplements };
}
