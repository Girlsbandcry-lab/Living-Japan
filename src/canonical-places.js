import { getIdentityOverride, identityOverrides, sanitizeIdentity } from './place-identity-overrides.js';
import { displayRepresentativeId, isSecondaryDisplayPoint, augmentDisplayRepresentative, secondaryDisplayDetailPaths, isHiddenAggregateDisplayPoint } from './place-display-representatives.js';
import { isRetiredLivingArea } from './living-area-retirement.js';
import { metroPurposeType } from './metro-purpose-presentation.js';
import { createSearchResultItem } from './search-result.js';
import { normalizeSearchText as normalized, tokenizeSearchQuery, prepareSearchFields, matchesPreparedSearchFields } from './search-text.js';
// LJ-CANONICAL-CATALOG-20261030: one writing place per row; original source IDs stay resolvable.
const hiddenDisplayRow = row => isRetiredLivingArea(row) || isSecondaryDisplayPoint(row) || isHiddenAggregateDisplayPoint(row);
const secondaryPaths = new Set(secondaryDisplayDetailPaths);
const sources = row => [...new Set([row.id, ...(row.sourceIds || []), row.legacyPlaceId].filter(Boolean))];
const rail = row => row.type === '车站' || ['train_station', 'light_rail_and_subway_station'].includes(row.subtype);
const intersects = (a, b) => !a || !b || !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
const coordinate = value => Array.isArray(value) ? { longitude: value[0], latitude: value[1] } : value;

export function canonicalAliasBucket(id) {
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(String(id))) hash = Math.imul(hash ^ byte, 16777619);
  return (hash >>> 0) & 255;
}

export function placeDistanceMeters(left, right) {
  const a = coordinate(left?.coordinates), b = coordinate(right?.coordinates);
  if (![a?.longitude, a?.latitude, b?.longitude, b?.latitude].every(Number.isFinite)) return Infinity;
  const rad = Math.PI / 180, lat = (b.latitude - a.latitude) * rad, lon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(lat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(lon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function createCanonicalPlaces({ index, read, project, present = entity => entity }) {
  const overture = index.runtimeSource?.kind === 'overture';
  const legacyOverrides = overture ? [] : identityOverrides;
  const overrideFor = overture ? () => null : getIdentityOverride;
  const displayId = overture ? id => id : displayRepresentativeId;
  const spec = index.canonicalPlaces, cache = new Map(), pending = new Map(), summaries = new Map();
  // LJ-LIGHT-CATALOG-20261030: search and page references do not scan complete source records.
  const lightweight = spec.catalogIndex, lightCache = new Map();
  const lightParts = lightweight?.parts || [], lightPaths = new Map(lightParts.map(part => [part.path, part]));
  const byDetailPath = new Map(lightParts.map((part, number) => [part.detailPath, number]));
  // LJ-SPATIAL-INDEX-20261030: maps and nearby read bounded spatial rows; detail mode reads stations only.
  const spatial = spec.spatialIndex, spatialCache = new Map(), stationCache = new Map();
  const spatialPaths = new Map((spatial?.parts || []).map(part => [part.path, part]));
  const stationPaths = new Map((spatial?.stationParts || []).map(part => [part.path, part]));
  const admin = new Map((index.adminNodes || []).map(row => [row.id, row]));
  const categories = new Map((spec.categories || []).map(row => [row.id, row]));
  const geographicParts = spec.geographicIndex?.parts || [], geographicLoads = new Map(), geographicNodesById = new Map();
  const referencedParents = new Set(), parentNames = new Map(), parentContexts = new Map();
  const geographicRegions = new Map(), readyGeographicRegions = new Set(), administrativeNames = new Map();
  let searchDocuments = new WeakMap();
  const nameFields = row => [row?.name, row?.label, row?.nameJa, row?.shortName, row?.originalName, row?.activationName,
    ...(row?.originalNames || []), ...(row?.aliases || []), ...(row?.fullNames || []), ...(row?.searchAliases || []), ...(row?.chainSearchOnlyNames || [])].filter(Boolean);
  const aliasParts = new Map();
  const activationParts = new Map((spec.activationIndex?.parts || []).map(part => [part.prefix, part]));
  const activationCache = new Map();
  for (const part of spec.aliasParts || []) { const key=Number(part.bucket); if(!aliasParts.has(key)) aliasParts.set(key,[]); aliasParts.get(key).push(part); }
  const check = signal => { if (signal?.aborted) { const error = new Error('Search superseded'); error.name = 'AbortError'; throw error; } };
  const scanYield = signal => {
    let deadline = performance.now() + 10;
    return async () => {
      check(signal);
      if (!signal || performance.now() < deadline) return;
      await new Promise(resolve => setTimeout(resolve, 0)); check(signal);
      deadline = performance.now() + 10;
    };
  };
  async function block(path) {
    const target = lightPaths.has(path) ? lightCache : spatialPaths.has(path) ? spatialCache : stationPaths.has(path) ? stationCache : cache;
    if (target.has(path)) { const entry = target.get(path); target.delete(path); target.set(path, entry); return entry.value; }
    if (!pending.has(path)) pending.set(path, read(path).then(value => {
      const bytes = (lightPaths.get(path) || spatialPaths.get(path) || stationPaths.get(path))?.jsonBytes || 0;
      target.set(path, { value, bytes });
      if (target === cache) { while (target.size > 8) target.delete(target.keys().next().value); }
      else {
        const budget = (target === lightCache ? 64 : target === spatialCache ? 32 : target === stationCache ? 8 : 16) * 1024 * 1024;
        let total = [...target.values()].reduce((sum, entry) => sum + entry.bytes, 0);
        while (target.size > 1 && (target.size > 256 || total > budget)) { const key = target.keys().next().value; total -= target.get(key).bytes; target.delete(key); }
      }
      return value;
    }).finally(() => pending.delete(path)));
    return pending.get(path);
  }
  function hydrate(row, indexOnly = false) {
    row = sanitizeIdentity(augmentDisplayRepresentative(row));
    const node = admin.get(row.adminNodeId), path = row.adminPath?.length ? row.adminPath : node ? [...(node.adminPath || []), node.id] : [];
    return present({ ...row, ...(indexOnly ? { canonicalIndexOnly: true } : {}), aliases: row.aliases || [], allSourceIds: sources(row), canonicalPlace: true,
      adminPath: path, adminNodes: path.map(id => admin.get(id)).filter(Boolean).map(node => ({ ...node, label: node.label || node.name })),
      packageIds: row.packageIds || [], bodyStatus: row.bodyStatus || 'empty' });
  }
  function partsFor({ regionCode, adminNodeId, bounds } = {}, parts = spec.parts) {
    const code = regionCode == null ? '00' : String(regionCode).padStart(2, '0');
    const view = [...(index.views || []), ...(index.regions || [])].find(region => region.code === code);
    const codes = new Set(view?.regionCodes || [code]);
    return parts.filter(part => (code === '00' || !part.regionCodes || part.regionCodes.some(code => codes.has(code))) &&
      (!adminNodeId || !part.adminNodeIds || (adminNodeId === 'browse:unassigned' ? part.regionCodes?.includes('00') : part.adminNodeIds.includes(adminNodeId))) && intersects(part.bounds, bounds));
  }
  function overrideMatches(row, options = {}) {
    if (index.packageMode && !index.activeRegionCodes.includes(row.regionCode)) return false;
    const code = options.regionCode == null ? '00' : String(options.regionCode).padStart(2, '0');
    const view = [...(index.views || []), ...(index.regions || [])].find(region => region.code === code);
    return (code === '00' || (view?.regionCodes || [code]).includes(row.regionCode)) && (!options.adminNodeId || options.adminNodeId === row.adminNodeId) && (!options.bounds || intersects(options.bounds, [...project(row.coordinates), ...project(row.coordinates)]));
  }
  async function aliasRef(id) {
    for (const part of aliasParts.get(canonicalAliasBucket(id)) || []) { const ref=(await block(part.path)).aliases?.[id]; if(ref) return ref; }
    return null;
  }
  async function allowedRefs(ids, signal) {
    const buckets = new Map(), found = new Map();
    for (const originalId of ids) { const id = displayId(originalId), override = overrideFor(id); if (override) { found.set(override.id, { id: override.id, path: '@override' }); continue; } const bucket = canonicalAliasBucket(id); if (!buckets.has(bucket)) buckets.set(bucket, []); buckets.get(bucket).push(id); }
    for (const [bucket, identities] of buckets) {
      check(signal);
      for (const part of aliasParts.get(bucket) || []) {
        const aliases = (await block(part.path)).aliases || {}; check(signal);
        for (const id of identities) if (aliases[id]) found.set(aliases[id].id, aliases[id]);
      }
    }
    return found;
  }
  async function* rows(options = {}, useIndex = false) {
    const yieldScan = scanYield(options.signal), seen = new Set();
    const indexed = useIndex && lightweight;
    const references = indexed && Array.isArray(options.entityIds) ? await allowedRefs(options.entityIds, options.signal) : null;
    const allowed = references ? new Set(references.keys()) : Array.isArray(options.entityIds) ? new Set(options.entityIds) : null;
    if (allowed?.size === 0) return;
    const allowedParts = references ? new Set([...references.values()].map(ref => ref.path)) : null;
    for (const part of partsFor(options, indexed ? lightParts : spec.parts)) {
      check(options.signal);
      if (allowedParts && !allowedParts.has(part.detailPath)) continue;
      let scanned = 0;
      for (const original of (await block(part.path)).rows || []) {
        check(options.signal);
        if (++scanned % 512 === 0) await yieldScan();
        const override = overrideFor(original.id), row = override || original;
        if (override && !overrideMatches(row, options)) continue;
        if (options.adminNodeId && (options.adminNodeId === 'browse:unassigned' ? row.adminNodeId != null : row.adminNodeId !== options.adminNodeId)) continue;
        if (allowed && !(indexed ? allowed.has(row.id) : sources(row).some(id => allowed.has(id)))) continue;
        if (!hiddenDisplayRow(row) && !seen.has(row.id)) { seen.add(row.id); yield row; }
      }
      await yieldScan();
    }
    for (const row of legacyOverrides) if (!seen.has(row.id) && overrideMatches(row, options) && (!allowed || allowed.has(row.id) || sources(row).some(id => allowed.has(id)))) { seen.add(row.id); yield row; }
  }
  async function resolve(id) {
    if (isRetiredLivingArea(id) || isHiddenAggregateDisplayPoint(id)) return null;
    id = displayId(id);
    const override = overrideFor(id); if (override) return overrideMatches(override) ? hydrate(override) : null;
    const ref = await aliasRef(id); if (!ref || isRetiredLivingArea(ref.id)) return null;
    const row = (await block(ref.path)).rows?.find(row => row.id === ref.id);
    return row && !hiddenDisplayRow(row) ? hydrate(row) : null;
  }
  async function activationCandidates(texts) {
    const normalize = value => String(value || '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').toLocaleLowerCase();
    const text = (texts || []).map(normalize), wanted = new Set(), found = new Map();
    for (const value of text) {
      const chars = [...value];
      for (let i = 0; i < chars.length; i++) {
        if (activationParts.has(chars[i])) wanted.add(chars[i]);
        if (i + 1 < chars.length && activationParts.has(chars[i] + chars[i + 1])) wanted.add(chars[i] + chars[i + 1]);
      }
    }
    const prefixes = [...wanted];
    for (let start = 0; start < prefixes.length; start += 8) {
      await Promise.all(prefixes.slice(start, start + 8).map(async prefix => {
        const part = activationParts.get(prefix);
        if (!activationCache.has(prefix)) activationCache.set(prefix, read(part.path).catch(error => { activationCache.delete(prefix); throw error; }));
        const payload = await activationCache.get(prefix);
        for (const row of payload.rows || []) {
          const terms = row.lookupTerms || row.fullNames || [row.name];
          if (!terms.some(term => term && text.some(value => value.includes(normalize(term))))) continue;
          const previous = found.get(row.id);
          found.set(row.id, { ...row, fullNames: [...new Set([...(previous?.fullNames || []), ...(row.fullNames || [row.name])])] });
        }
      }));
      while (activationCache.size > 256) activationCache.delete(activationCache.keys().next().value);
    }
    return [...found.values()];
  }
  async function livingAreas(regionCode, bounds) {
    const result = [];
    for (const part of partsFor({ regionCode, bounds }, spec.livingAreaIndex?.parts || [])) {
      for (const row of (await block(part.path)).rows || []) {
        const xy = project(row.displayAnchorCoordinates);
        if (xy && xy[0] >= bounds[0] && xy[0] <= bounds[2] && xy[1] >= bounds[1] && xy[1] <= bounds[3]) result.push(hydrate(row, true));
      }
    }
    return result;
  }
  async function* spatialRows(options, stationsOnly = false) {
    if (!spatial) { yield* rows(options); return; }
    const yieldScan = scanYield(options.signal), seen = new Set();
    const parts = partsFor(options, stationsOnly ? spatial.stationParts : spatial.parts);
    if (options.searchPriorityCenter) {
      const [x, y] = options.searchPriorityCenter;
      const distance = part => {
        const box = part.bounds, dx = Math.max(box[0] - x, 0, x - box[2]), dy = Math.max(box[1] - y, 0, y - box[3]);
        return dx * dx + dy * dy;
      };
      let nearest = 0, best = Infinity;
      for (let index = 0; index < parts.length; index++) {
        const value = distance(parts[index]);
        if (value < best) { best = value; nearest = index; }
      }
      if (nearest > 0) parts.unshift(parts.splice(nearest, 1)[0]);
    }
    for (const part of parts) {
      check(options.signal); let scanned = 0;
      for (const row of (await block(part.path)).rows || []) {
        check(options.signal);
        if (++scanned % 512 === 0) await yieldScan();
        const resolved = overrideFor(row.id) || row;
        if (resolved !== row && !overrideMatches(resolved, options) || stationsOnly && !rail(resolved)) continue;
        if (!hiddenDisplayRow(row) && !seen.has(resolved.id)) { seen.add(resolved.id); yield resolved; }
      }
      await yieldScan();
    }
    // LJ-STATION-SPATIAL-20261031: restore independent station identities absent from the merged spatial index.
    for (const row of legacyOverrides) if (!seen.has(row.id) && overrideMatches(row, options) && (!stationsOnly || rail(row))) { seen.add(row.id); yield row; }
  }
  function administrativeContext(row) {
    function nodeFields(ref, seen = new Set()) {
      const node = typeof ref === 'string' ? admin.get(ref) : admin.get(ref?.id) || ref;
      if (!node || seen.has(node.id)) return [];
      if (administrativeNames.has(node.id)) return administrativeNames.get(node.id);
      seen.add(node.id);
      const fields = prepareSearchFields(nameFields(node));
      for (const parent of [...(node.adminPath || []), node.parentId].filter(Boolean)) fields.push(...nodeFields(parent, seen));
      const result = [...new Set(fields)];
      if (admin.has(node.id)) administrativeNames.set(node.id, result);
      return result;
    }
    return [...new Set([...(row.adminPath || []), row.adminNodeId].filter(Boolean).flatMap(ref => nodeFields(ref)))];
  }
  function loadGeographicContext(regionCode) {
    const region = String(regionCode || '00');
    if (!geographicRegions.has(region)) geographicRegions.set(region, Promise.all(partsFor({ regionCode }, geographicParts).map(part => {
      if (!geographicLoads.has(part.path)) geographicLoads.set(part.path, read(part.path).then(payload => {
        const records = payload.nodes || [];
        for (const node of records) for (const ref of node.parents || []) referencedParents.add(typeof ref === 'string' ? ref : ref.id);
        for (const node of records) {
          if (hiddenDisplayRow(node) || !(node.parents?.length || node.childCount > 0 || referencedParents.has(node.id))) continue;
          const previous = geographicNodesById.get(node.id);
          const parents = new Map([...(previous?.parents || []), ...(node.parents || []).map(ref => typeof ref === 'string' ? { id: ref, regionCode: node.regionCode } : ref)].map(ref => [ref.id, ref]));
          geographicNodesById.set(node.id, { id: node.id, fields: nameFields(node), regionCode: node.regionCode,
            ref: node.ref || previous?.ref, parents: [...parents.values()] });
        }
      }).catch(error => { geographicLoads.delete(part.path); throw error; }));
      return geographicLoads.get(part.path);
    })).then(() => { readyGeographicRegions.add(region); }).catch(error => { geographicRegions.delete(region); throw error; }));
    return geographicRegions.get(region);
  }
  async function parentNameFields(node) {
    if (!parentNames.has(node.id)) parentNames.set(node.id, (async () => {
      if (!lightPaths.has(node.ref?.path) || !Number.isInteger(node.ref?.index)) return prepareSearchFields(node.fields);
      const row = (await block(node.ref.path)).rows?.[node.ref.index];
      if (!row || row.id !== node.id) return prepareSearchFields(node.fields);
      return prepareSearchFields([...node.fields, ...nameFields(row), ...nameFields(present(augmentDisplayRepresentative(sanitizeIdentity(row))))]);
    })().catch(error => { parentNames.delete(node.id); throw error; }));
    return parentNames.get(node.id);
  }
  async function facilityContext(row, options) {
    if (parentContexts.has(row.id)) return parentContexts.get(row.id);
    const entry = geographicNodesById.get(row.id);
    if (!entry?.parents.length) return [];
    const fields = [], pending = [...entry.parents], seen = new Set([row.id]);
    while (pending.length) {
      const ref = pending.pop(); if (seen.has(ref.id)) continue; seen.add(ref.id);
      if (admin.has(ref.id)) { fields.push(...administrativeContext({ adminNodeId: ref.id })); continue; }
      let parent = geographicNodesById.get(ref.id);
      if (!parent) { await loadGeographicContext(ref.regionCode || row.regionCode || options.regionCode); check(options.signal); parent = geographicNodesById.get(ref.id); }
      if (!parent) continue;
      fields.push(...await parentNameFields(parent)); check(options.signal); pending.push(...parent.parents);
    }
    parentContexts.set(row.id, [...new Set(fields)]);
    return parentContexts.get(row.id);
  }
  async function searchMatch(original, tokens, options) {
    if (options.excludedIds?.includes(original.id)) return null;
    let document = searchDocuments.get(original);
    if (!document) {
      const row = sanitizeIdentity(original), shown = present(augmentDisplayRepresentative(row)), purpose = metroPurposeType(row);
      const own = prepareSearchFields([...nameFields(row), ...nameFields(shown), ...(purpose ? [purpose] : [row.type, shown.displayType]),
        row.subtype, ...(row.typePathIds || []).map(id => categories.get(id)?.name || '')]);
      document = { row, shown, own, context: administrativeContext(row), parentsReady: !geographicParts.length };
      searchDocuments.set(original, document);
    }
    if (matchesPreparedSearchFields(document.own, tokens, document.context)) return document;
    if (document.parentsReady) return null;
    const region = document.row.regionCode || options.regionCode;
    if (!readyGeographicRegions.has(String(region || '00'))) { await loadGeographicContext(region); check(options.signal); }
    if (geographicNodesById.get(document.row.id)?.parents.length) document.context = [...new Set([...document.context, ...await facilityContext(document.row, options)])];
    document.parentsReady = true;
    return matchesPreparedSearchFields(document.own, tokens, document.context) ? document : null;
  }
  function searchResultItem(item) {
    if (item.entity) return { ...item, ...createSearchResultItem(item.entity) };
    const node = admin.get(item.adminNodeId), path = item.adminPath?.length ? item.adminPath : node ? [...(node.adminPath || []), node.id] : [];
    const entity = { ...item, canonicalPlace: true, canonicalIndexOnly: true, adminPath: path, adminNodes: path.map(id => admin.get(id)).filter(Boolean).map(node => ({ ...node, label: node.label || node.name })) };
    return { ...item, ...createSearchResultItem(entity) };
  }
  async function scanSearch(query, options = {}) {
    const q = normalized(query).trim(), tokens = tokenizeSearchQuery(q), checked = new Set(); let scanned = 0, matched = 0, phase = 'priority', batch = [], progressAt = performance.now();
    const flush = () => { if (batch.length) { options.onBatch?.(batch, { scanned, matched, phase }); batch = []; } };
    const consider = async original => {
      if (checked.has(original.id)) return; checked.add(original.id); scanned++;
      const match = await searchMatch(original, tokens, options); check(options.signal);
      if (match) {
        const { row, shown } = match, coordinates = coordinate(row.coordinates), point = project(coordinates);
        batch.push({ id: row.id, name: shown.name || row.name, type: shown.displayType || shown.type || row.type || '地点', kind: row.kind, subtype: row.subtype, categoryCode: row.categoryCode, typePathIds: row.typePathIds,
          legacyPlaceId: row.legacyPlaceId, packageIds: row.packageIds, bodyStatus: row.bodyStatus, sourceIds: row.sourceIds, adminNodeId: row.adminNodeId, adminPath: row.adminPath, regionCode: row.regionCode || '00', searchSource: 'canonical',
          livingAreaRole: row.livingAreaRole, displayAnchorCoordinates: row.displayAnchorCoordinates, livingAreaBounds: row.livingAreaBounds,
          coordinates: point && point.every(Number.isFinite) ? { ...coordinates, x: point[0], y: point[1] } : null }); matched++;
        if (matched === 1 || batch.length >= 128) flush();
      }
      if (performance.now() - progressAt >= 100) { flush(); options.onProgress?.({ scanned, matched, phase }); progressAt = performance.now(); }
    };
    if (q && options.priorityBounds) {
      const bounds = options.priorityBounds, searchPriorityCenter = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
      const source = spatial ? spatialRows({ ...options, bounds, searchPriorityCenter }, false) : rows(options, true);
      for await (const row of source) {
        check(options.signal); const point = project(coordinate(row.coordinates));
        if (point && point[0] >= bounds[0] && point[0] <= bounds[2] && point[1] >= bounds[1] && point[1] <= bounds[3]) await consider(row);
      }
    }
    check(options.signal); flush(); options.onPhase?.({ phase: 'priority', complete: true, scanned, matched }); phase = 'remainder';
    if (q) for await (const row of rows(options, true)) { check(options.signal); await consider(row); }
    check(options.signal); flush(); return { scanned, matched, complete: true };
  }
  async function search(query, options = {}) {
    const q = normalized(query).trim(), tokens = tokenizeSearchQuery(q), found = [], limit = Math.min(500, Math.max(1, options.limit || 100));
    if (!q) return found;
    for await (const original of rows(options, true)) {
      const match = await searchMatch(original, tokens, options);
      if (match) found.push(hydrate(match.row, Boolean(lightweight)));
      if (found.length >= limit) break;
    }
    return found;
  }
  async function resolveReference(ref) {
    if (!ref?.path || !Number.isInteger(ref.index)) return null;
    const row = (await block(ref.path)).rows?.[ref.index];
    return row && !hiddenDisplayRow(row) ? hydrate(overrideFor(row.id) || row, lightPaths.has(ref.path)) : null;
  }
  async function resolveLight(id) {
    if (isRetiredLivingArea(id) || isHiddenAggregateDisplayPoint(id)) return null;
    id = displayId(id);
    const override = overrideFor(id);
    if (override) return overrideMatches(override) ? hydrate(override) : null;
    const ref = await aliasRef(id);
    if (!ref) return null;
    const part = byDetailPath.get(ref.path), path = part === undefined ? ref.path : lightParts[part].path;
    const row = (await block(path)).rows?.find(row => row.id === ref.id);
    return row && !hiddenDisplayRow(row) ? hydrate(row, part !== undefined) : null;
  }
  async function resolveLights(ids) {
    const references = await allowedRefs(ids), groups = new Map(), result = new Map();
    for (const ref of references.values()) {
      if (ref.path === '@override') { result.set(ref.id, hydrate(overrideFor(ref.id))); continue; }
      if (!groups.has(ref.path)) groups.set(ref.path, new Set());
      groups.get(ref.path).add(ref.id);
    }
    for (const [detailPath, wanted] of groups) {
      const number = byDetailPath.get(detailPath), path = number === undefined ? detailPath : lightParts[number].path;
      for (const row of (await block(path)).rows || []) if (wanted.has(row.id) && !hiddenDisplayRow(row)) result.set(row.id, hydrate(row, number !== undefined));
    }
    return [...result.values()];
  }
  async function geographicNodes(regionCode) {
    const nodes = new Map();
    for (const part of partsFor({ regionCode }, lightParts.length ? lightParts : spec.parts)) {
      const records = (await block(part.path)).rows || [];
      for (let position = 0; position < records.length; position++) {
        const original = records[position];
        if (hiddenDisplayRow(original)) continue;
        const row = overrideFor(original.id) || original;
        const presented = hydrate(row, Boolean(lightParts.length));
        nodes.set(row.id, { id: row.id, name: presented.name, regionCode: row.regionCode, adminNodeId: row.adminNodeId,
          ref: { path: part.path, index: position }, parents: [] });
      }
    }
    return { nodes: [...nodes.values()] };
  }
  const matchesCategory = (row, options) => !options.categoryId || (options.categoryIds || [options.categoryId]).includes(row.typePathIds?.at(-1));
  // Flat row queries remain available for consumers; geographic navigation lives in geographic-directory.
  async function children(adminNodeId, options = {}) {
    const found = [], offset = Math.max(0, options.offset || 0), limit = Math.min(500, Math.max(1, options.limit || 48)); let seen = 0;
    for await (const row of rows({ ...options, adminNodeId }, true)) {
      if (!matchesCategory(row, options)) continue;
      if (seen++ >= offset) found.push(hydrate(row, Boolean(lightweight)));
      if (found.length >= limit) break;
    }
    return found;
  }
  async function position(adminNodeId, id, options = {}) {
    if (isRetiredLivingArea(id) || isHiddenAggregateDisplayPoint(id)) return -1;
    id = displayId(id);
    const ref = await aliasRef(id), target = ref?.id || id;
    let position = 0;
    for await (const row of rows({ ...options, adminNodeId }, true)) {
      if (!matchesCategory(row, options)) continue;
      if (row.id === target || !ref && !overrideFor(id) && sources(row).includes(id)) return position;
      position++;
    }
    return -1;
  }
  async function summary(adminNodeId, options = {}) {
    const key = JSON.stringify([adminNodeId, options.regionCode, options.entityIds]);
    if (summaries.has(key)) return summaries.get(key);
    const ids = new Set(); let stationCount = 0;
    for await (const row of rows({ ...options, adminNodeId }, true)) {
      if (rail(row)) stationCount++;
      else for (const id of row.typePathIds || []) ids.add(id);
    }
    const value = { categoryIds: [...ids], stationCount };
    summaries.set(key, value); while (summaries.size > 24) summaries.delete(summaries.keys().next().value);
    return value;
  }
  async function viewport(regionCode, bounds, { mode, visible, consider, signal } = {}) {
    const seen = new Set();
    for (const stationsOnly of mode === 'ultra' ? [true, false] : [true]) for await (const row of spatialRows({ regionCode, bounds, signal }, stationsOnly)) {
      const redirected = row.writingRepresentativeId && row.writingRepresentativeId !== row.id;
      const representative = redirected ? await resolve(row.writingRepresentativeId) : row;
      if (!representative || seen.has(representative.id) || mode !== 'ultra' && !rail(row) || !visible(representative)) continue;
      seen.add(representative.id);
      const xy = project(representative.coordinates); if (xy) consider(...xy, () => redirected ? representative : hydrate(row, Boolean(spatial)));
    }
  }
  async function nearby(entity, { radiusMeters = 800, limit = 8 } = {}) {
    const point = coordinate(entity.coordinates); if (!Number.isFinite(point?.longitude) || !Number.isFinite(point?.latitude)) return [];
    const latitude = radiusMeters / 110500, longitude = radiusMeters / (110500 * Math.max(0.01, Math.cos(point.latitude * Math.PI / 180)));
    const a = project({ longitude: point.longitude - longitude, latitude: point.latitude - latitude }), b = project({ longitude: point.longitude + longitude, latitude: point.latitude + latitude });
    const bounds = a && b ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])] : undefined;
    const found = [];
    for await (const row of spatialRows({ bounds })) {
      if (row.id === entity.id || sources(row).includes(entity.id)) continue;
      const distanceMeters = placeDistanceMeters(entity, row);
      if (distanceMeters <= radiusMeters) found.push({ ...hydrate(row, Boolean(spatial)), distanceMeters });
    }
    return found.sort((a, b) => a.distanceMeters - b.distanceMeters || a.id.localeCompare(b.id)).slice(0, limit);
  }
  return { resolve, resolveLight, resolveLights, resolveReference, geographicNodes, activationCandidates, livingAreas, search, scanSearch, searchResultItem, summary, children, position, viewport, nearby, clear() { cache.clear(); lightCache.clear(); spatialCache.clear(); stationCache.clear(); activationCache.clear(); summaries.clear(); geographicLoads.clear(); geographicNodesById.clear(); referencedParents.clear(); parentNames.clear(); parentContexts.clear(); geographicRegions.clear(); readyGeographicRegions.clear(); administrativeNames.clear(); searchDocuments = new WeakMap(); } };
}
