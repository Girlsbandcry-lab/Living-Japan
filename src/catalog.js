import { currentMetroNames } from './metro-names.js';
import { getIdentityOverride, identityOverrides, sanitizeIdentity } from './place-identity-overrides.js';
import { displayRepresentativeId, isSecondaryDisplayPoint, augmentDisplayRepresentative, isHiddenAggregateDisplayPoint } from './place-display-representatives.js';
import { normalizeMapPointVisibility, isMapPointVisible } from './map-point-categories.js';
import { createFacilityGroups } from './facility-groups.js';
import { createGeographicDirectory } from './geographic-directory.js';
import { deduplicateMapPoints } from './map-point-dedup.js';
import { presentCatalogEntity } from './place-metadata.js';
import { createCanonicalPlaces, placeDistanceMeters } from './canonical-places.js';
import { buildStationNameRules, createStationPresenter } from './station-presentation.js';
import { chooseRelatedPlaces, chooseRelatedIntroductions } from './related-place-selection.js';
import { mapLevelPolicy, presentationForRegion } from './map-levels.js';
import { isRetiredLivingArea } from './living-area-retirement.js';
import { regionSelectionRelations, applyRegionSelection } from './region-selections.js';
import { createMapSearchSession } from './map-search-session.js';
import { createTextSearchSession } from './text-search-session.js';
import { createSearchResultItem } from './search-result.js';
import { normalizeSearchText as normalize, matchesSearchFields } from './search-text.js';
import { applyPlaceEdit, normalizePlaceEdits, placeEditRecord, placeEditIdentityIds, placeEditPackageId } from './place-edits.js';

// LJ-NATIONAL-01: source identities, official administration and sparse text slots.
export function mapPointId(point) {
  const ns = point[10] || 'unknown';
  if (point[8]) return `map:${ns}:${point[8]}`;
  return `map:${ns}:legacy:${point[0]},${point[1]}:${point[2]}:${encodeURIComponent(point[3] || '')}:${encodeURIComponent(point[6] || '')}:${encodeURIComponent(point[7] || '')}`;
}

const TYPE_NAMES = { 景: '景点', 馆: '博物馆', 社: '神社', 寺: '寺院', 大: '大学', 医: '医疗', 剧: '剧场', 商: '商场', 超: '超市', 图: '图书馆', 校: '学校', 便: '便利店', 咖: '咖啡', 包: '面包店', 书: '书店', 酒: '酒吧', 歌: '卡拉OK', 宿: '住宿', 食: '餐饮', 艺: '文化艺术', 游: '娱乐', 体: '体育', 园: '公园', 店: '商店', 宗: '宗教', 服: '服装店', 政: '公共服务', 办: '办公', 交: '交通', 住: '住宅', 工: '工业', 地: '地理地点', 建: '建筑' };
// LJ-BROWSE-CATEGORIES-01: display categories share original identities and official paths.
const railSubtype = new Set(['train_station', 'light_rail_and_subway_station']);
const isRailType = (type, subtype) => type === '车站' || railSubtype.has(subtype);
const isRailEntity = entity => isRailType(entity.type, entity.subtype);
const browseTypes = (type, subtype) => subtype === 'bus_station' ? ['公交站'] : [...new Set(String(type || '地点').split('／').map(label => label.trim()).filter(Boolean))];
const entityTypes = entity => browseTypes(entity.type, entity.subtype);
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const at = () => globalThis.performance?.now?.() ?? Date.now();
const unassignedId = 'browse:unassigned';
const unassignedPart = part => !part.adminNodeIds || part.adminNodeIds.length === 0 || part.regionCodes?.includes('00');
const regionKey = code => String(code ?? '00').padStart(2, '0');
const nationalUrl = (baseUrl, name) => new URL(`data/national/${name}`, baseUrl || import.meta.url.replace(/src\/catalog\.js.*$/, '')).href;

export function projectCoordinates(coordinates, projection) {
  if (!coordinates) return null;
  if (Number.isFinite(coordinates.x) && Number.isFinite(coordinates.y)) return [coordinates.x, coordinates.y];
  const longitude = coordinates.longitude ?? coordinates.lng ?? coordinates.lon;
  const latitude = coordinates.latitude ?? coordinates.lat;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || !projection?.xScale) return null;
  return [longitude * projection.xScale + projection.xOffset, latitude * projection.yScale + projection.yOffset];
}

function coordinatesAt(x, y, projection) {
  return { x, y, crs: 'japan-map-v3-local', ...(projection?.xScale ? {
    longitude: (x - projection.xOffset) / projection.xScale,
    latitude: (y - projection.yOffset) / projection.yScale,
    method: 'map-source-projection',
  } : {}) };
}

function administration(index) {
  const nodes = new Map((index.adminNodes || []).map(n => [n.id, n]));
  const names = new Map();
  for (const node of nodes.values()) {
    const path = [...(node.adminPath || []), node.id];
    const labelPath = path.map(id => nodes.get(id)?.nameJa || nodes.get(id)?.name || '').filter(Boolean);
    for (const label of new Set([node.name, node.nameJa, ...(node.aliases || [])])) {
      if (!label || !node.regionCode) continue;
      const key = `${node.regionCode}:${label}`;
      if (!names.has(key)) names.set(key, []);
      names.get(key).push(node);
    }
    if (node.kind === 'ward') {
      const parent = nodes.get(node.parentId);
      for (const label of [`${parent?.nameJa || ''}${node.nameJa || ''}`, `${parent?.name || ''}${node.name || ''}`]) names.set(`${node.regionCode}:${label}`, [node]);
    }
    node._labelPath = labelPath;
  }
  const resolve = (code, name = '') => {
    const candidates = names.get(`${code}:${name}`) || [];
    return candidates.length === 1 ? candidates[0] : [...nodes.values()].find(n => n.kind === 'prefecture' && n.regionCode === code);
  };
  const pathFor = node => node ? [...(node.adminPath || []), node.id] : [];
  const details = path => path.map(id => nodes.get(id)).filter(Boolean).map(n => ({ id: n.id, label: n.name, name: n.name, nameJa: n.nameJa, kind: n.kind, parentId: n.parentId, officialCode: n.officialCode }));
  return { nodes, resolve, pathFor, details };
}

function simplifyPath(path, tolerance = 1, thinExplicitLines = false) {
  let lastX = NaN, lastY = NaN, result = '';
  const tokens = String(path || '').match(/[MLZmlz]|-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/g) || [];
  let mode = 'M';
  for (let i = 0; i < tokens.length;) {
    if (/^[MLZ]$/i.test(tokens[i])) {
      mode = tokens[i++].toUpperCase();
      if (mode === 'Z') { result += 'Z'; lastX = lastY = NaN; continue; }
    }
    const x = Number(tokens[i++]), y = Number(tokens[i++]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (mode === 'M' || !Number.isFinite(lastX) || Math.hypot(x - lastX, y - lastY) >= tolerance || i >= tokens.length || (thinExplicitLines ? /^[MZ]$/i : /^[MLZ]$/i).test(tokens[i])) {
      result += `${mode}${x},${y}`; lastX = x; lastY = y;
    }
    mode = 'L';
  }
  return result;
}

/** Runs inside the dedicated worker in browsers; inline only for small Node fixtures. */
export function createRegionService({ index, baseUrl, fetcher = globalThis.fetch, maxRegions = 2, maxDecodedBytes = 128 * 1024 * 1024, stationNames = {}, placeMetadata, onSearchUpdate = () => {} }) {
  const admin = administration(index), cache = new Map(), pending = new Map();
  const pointCache = new Map(), pointPending = new Map();
  const facilityFiles = new Map();
  let landOverviewPromise, presentationPromise;
  let roadsIndexPromise;
  const roadCache = new Map(), roadPending = new Map();
  const overlayCache = new Map(), overlayPending = new Map();
  const overlayBytes = () => [...overlayCache.values()].reduce((n, item) => n + item.jsonBytes, 0);
  let overviewSummary = null, overviewSerial = 0;
  let loadQueue = Promise.resolve();
  const specs = new Map([...(index.views || []), ...(index.regions || [])].map(r => [regionKey(r.code), r]));
  const projection = index.projection || {};
  const overture = index.runtimeSource?.kind === 'overture';
  const presentStation = createStationPresenter(stationNames);
  const metadataContext = { placeMetadata };
  const presentPoint = row => { const entity = presentStation(row); return entity?.displayType === '铁路车站' ? entity : presentCatalogEntity(entity, metadataContext); };
  async function read(path) {
    const response = await fetcher(nationalUrl(baseUrl, path));
    if (!response.ok) throw new Error(`地区资料读取失败：${path} (${response.status})`);
    if (!path.endsWith('.gz')) return response.json();
    const reader = response.body.getReader(), initial = []; let initialSize = 0;
    while (initialSize < 2) { const next = await reader.read(); if (next.done) break; initial.push(next.value); initialSize += next.value.length; }
    const magic = new Uint8Array(initialSize); let cursor = 0; for (const chunk of initial) { magic.set(chunk, cursor); cursor += chunk.length; }
    const stream = new ReadableStream({ start(controller) { for (const chunk of initial) controller.enqueue(chunk); }, async pull(controller) { const next = await reader.read(); next.done ? controller.close() : controller.enqueue(next.value); }, cancel(reason) { return reader.cancel(reason); } });
    // Hosts may transparently decode HTTP gzip; peek without buffering the whole compressed file.
    if (magic[0] !== 0x1f || magic[1] !== 0x8b) return new Response(stream).json();
    if (!globalThis.DecompressionStream) throw new Error('此浏览器缺少压缩资料读取能力，请升级浏览器后重试。');
    return new Response(stream.pipeThrough(new DecompressionStream('gzip'))).json();
  }
  const canonical = index.canonicalPlaces ? createCanonicalPlaces({ index, read, project: point => projectCoordinates(point, projection), present: presentPoint }) : null;
  const mapSearch = canonical ? createMapSearchSession({ scan: (query, options) => canonical.scanSearch(query, options), formatItem: item => canonical.searchResultItem(item),
    positionOf(item) {
      const entity = item.entity || item;
      if (entity.type === '行政区' || entity.id?.startsWith('admin:') || ['country', 'prefecture', 'city', 'ward', 'town', 'village', 'administrative'].includes(entity.kind)) return { point: null, kind: 'boundary' };
      const source = value => Array.isArray(value) ? { longitude: value[0], latitude: value[1] } : value;
      const real = projectCoordinates(source(entity.coordinates), projection), anchor = projectCoordinates(source(entity.displayAnchorCoordinates), projection);
      const point = real?.every(Number.isFinite) ? real : anchor?.every(Number.isFinite) ? anchor : null;
      return { point: point ? { x: point[0], y: point[1] } : null, kind: real?.every(Number.isFinite) ? 'point' : point ? 'display-anchor' : 'unlocated' };
    }, onUpdate: onSearchUpdate }) : null;
  const textSearch = canonical ? createTextSearchSession({ scan: (query, options) => canonical.scanSearch(query, options),
    formatItem: item => canonical.searchResultItem(item), onUpdate: onSearchUpdate }) : null;
  const searchJobs = new Map(), searchVersions = new Map();
  function cancelSearch(scope, version) {
    if (Number.isFinite(version)) { if (version < (searchVersions.get(scope) || 0)) return; searchVersions.set(scope, version); }
    searchJobs.get(scope)?.abort(); searchJobs.delete(scope);
    mapSearch?.cancel(scope);
    textSearch?.cancel(scope);
  }
  function startMapSearch(query, { requestScope = 'map-search', requestVersion, ...options } = {}) {
    if (!mapSearch) throw new Error('当前目录没有可用的标准地点搜索索引');
    if (Number.isFinite(requestVersion) && requestVersion < (searchVersions.get(requestScope) || 0)) return { cancelled: true, requestVersion };
    cancelSearch(requestScope, requestVersion);
    return mapSearch.start(query, { ...options, requestScope, requestVersion });
  }
  function startTextSearch(query, { requestScope = 'browse-search', requestVersion, ...options } = {}) {
    if (!textSearch) throw new Error('当前目录没有可用的轻量地点搜索索引');
    if (Number.isFinite(requestVersion) && requestVersion < (searchVersions.get(requestScope) || 0)) return { cancelled: true, requestVersion };
    cancelSearch(requestScope, requestVersion);
    return textSearch.start(query, { ...options, requestScope, requestVersion });
  }
  const viewportJobs = new Map(), viewportVersions = new Map(); let lastViewport = null;
  function cancelViewport(scope, version) {
    if (Number.isFinite(version)) { if (version < (viewportVersions.get(scope) || 0)) return; viewportVersions.set(scope, version); }
    viewportJobs.get(scope)?.abort(); viewportJobs.delete(scope);
  }
  const checkViewport = signal => { if (signal?.aborted) { const error = new Error('Viewport superseded'); error.name = 'AbortError'; throw error; } };
  async function pointBlock(part) {
    if (pointCache.has(part.path)) { const value = pointCache.get(part.path); pointCache.delete(part.path); pointCache.set(part.path, value); return value; }
    if (pointPending.has(part.path)) return pointPending.get(part.path);
    const request = read(part.path).then(value => { pointCache.set(part.path, value); while (pointCache.size > 4) pointCache.delete(pointCache.keys().next().value); return value; });
    pointPending.set(part.path, request); try { return await request; } finally { pointPending.delete(part.path); }
  }
  // LJ-PBF-OVERLAY-01: optional verified geometry stays in a bounded worker cache.
  async function overlayBlock(part, viewPaths, signal) {
    if (overlayCache.has(part.path)) { const entry = overlayCache.get(part.path); overlayCache.delete(part.path); overlayCache.set(part.path, entry); return entry.data; }
    if (overlayPending.has(part.path)) return overlayPending.get(part.path);
    const request = read(part.path).then(data => {
      if (signal?.aborted) return data;
      overlayCache.set(part.path, { data, jsonBytes: part.jsonBytes || JSON.stringify(data).length * 2 });
      // LJ-MAP-DRAG-CACHE-20261101: keep the current view's blocks within the existing byte budget.
      while (overlayBytes() > 32 * 1024 * 1024) {
        const oldest = [...overlayCache.keys()].find(path => !viewPaths.has(path)) ?? overlayCache.keys().next().value;
        overlayCache.delete(oldest);
      }
      return data;
    });
    overlayPending.set(part.path, request); try { return await request; } finally { overlayPending.delete(part.path); }
  }
  async function overlaysFor(code, bounds, mode, scale, signal) {
    const spec = specs.get(code); if (!spec?.overlayParts?.length || mode === 'schem') return null;
    let level = scale >= 0.6 ? 'detail' : 'overview';
    if (level === 'detail' && !spec.overlayParts.some(p => p.level === 'detail')) level = 'overview';
    const bandScale = 2 ** Math.ceil(Math.log2(Math.max(0.0001, scale))), summaryKey = `${code}:${mode}:${level}:${bandScale}:${scale >= 1}:${scale >= 4}`;
    if (overviewSummary?.key === summaryKey && bounds[0] >= overviewSummary.bounds[0] && bounds[1] >= overviewSummary.bounds[1] && bounds[2] <= overviewSummary.bounds[2] && bounds[3] <= overviewSummary.bounds[3]) {
      return { ...overviewSummary.value, metrics: { ...overviewSummary.value.metrics, viewCacheHit: true, overviewCacheHit: level === 'overview' } };
    }
    const marginX = (bounds[2] - bounds[0]) * 0.2, marginY = (bounds[3] - bounds[1]) * 0.2;
    const query = [bounds[0] - marginX, bounds[1] - marginY, bounds[2] + marginX, bounds[3] + marginY];
    const intersects = b => !b || !(b[2] < query[0] || b[0] > query[2] || b[3] < query[1] || b[1] > query[3]);
    const parts = [...new Map(spec.overlayParts.filter(p => p.level === level && intersects(p.bounds)).map(p => [p.path, p])).values()];
    const viewPaths = new Set(parts.map(part => part.path));
    const rails = new Map(), borders = new Map(), seenRails = new Set(), seenBorders = new Set(), railwaysActive = spec.overlayCoverage?.railwaysComplete === true;
    let railwayRecords = 0, boundaryRecords = 0;
    const maxAdminLevel = mode === 'map' ? 4 : mode === 'ultra' && scale >= 1 ? 8 : scale >= 0.6 ? 7 : 4;
    const append = (groups, key, fields, d) => {
      if (!groups.has(key)) groups.set(key, { ...fields, segments: [] });
      if (level === 'overview') d = d.split(/(?=M)/).filter(Boolean).map(ring => {
        const smaller = simplifyPath(ring, 0.6 / bandScale, true);
        return ring.includes('Z') && (smaller.match(/L/g) || []).length < 3 ? ring : smaller;
      }).join(' ');
      groups.get(key).segments.push(d);
    };
    for (const part of parts) {
      checkViewport(signal);
      const data = await overlayBlock(part, viewPaths, signal);
      checkViewport(signal);
      if (railwaysActive) for (const rail of data.railways || []) {
        if (seenRails.has(rail.id) || !intersects(rail.b) || !rail.d || (mode === 'map' && rail.kind !== 'rail')) continue;
        const service = rail.service || '', branch = service && service !== 'main';
        if (branch && !(mode === 'ultra' && scale >= 4)) continue;
        seenRails.add(rail.id); append(rails, `${rail.kind}:${service}`, { kind: rail.kind, service }, rail.d); railwayRecords++;
      }
      for (const boundary of data.boundaries || []) {
        const adminLevel = Number(boundary.adminLevel);
        if (seenBorders.has(boundary.id) || !intersects(boundary.b) || !boundary.d || adminLevel > maxAdminLevel) continue;
        seenBorders.add(boundary.id); append(borders, adminLevel, { adminLevel }, boundary.d); boundaryRecords++;
      }
    }
    const paths = groups => [...groups.values()].map(({ segments, ...fields }) => ({ ...fields, d: segments.join(' ') }));
    const value = { level, railwaysActive, railways: paths(rails), boundaries: paths(borders), metrics: { parts: parts.length, referencedBytes: parts.reduce((n, p) => n + (p.bytes || 0), 0), railwayRecords, boundaryRecords, viewCacheHit: false, overviewCacheHit: false } };
    value.cacheKey = `${level}:${++overviewSerial}`;
    const bytes = [...value.railways, ...value.boundaries].reduce((n, record) => n + record.d.length * 2 + 128, 0);
    overviewSummary = bytes <= 32 * 1024 * 1024 ? { key: summaryKey, bounds: query, value, bytes } : null;
    return value;
  }
  async function* pointRows(region, filter = () => true) {
    if (region.raw.poi?.list?.length) { yield region.raw.poi.list; return; }
    for (const part of specs.get(region.code)?.poiParts || []) if (filter(part)) { yield (await pointBlock(part)).rows; await tick(); }
  }
  async function* pbfRows(region, filter = () => true) {
    for (const part of specs.get(region.code)?.pbfParts || []) if (filter(part)) { yield (await pointBlock(part)).rows || []; await tick(); }
  }
  function pbfEntity(row, code) {
    const node = admin.nodes.get(row.adminNodeId), path = admin.pathFor(node);
    return { ...row, aliases: row.aliases || [], regionCode: row.regionCode || code, adminPath: path, adminNodes: admin.details(path),
      coordinates: row.coordinates || null, legacyPlaceId: null, packageIds: row.packageIds || [], bodyStatus: row.bodyStatus || 'empty' };
  }
  async function facilityGroups(code) {
    const found = [];
    for (const part of specs.get(regionKey(code))?.facilityParts || []) {
      if (!facilityFiles.has(part.path)) facilityFiles.set(part.path, read(part.path));
      const data = await facilityFiles.get(part.path); found.push(...(data.groups || []));
    }
    return found;
  }
  async function landOverview() {
    if (index.packageMode && !index.landOverviewPath) return [];
    landOverviewPromise ||= read(index.landOverviewPath || 'land-overview.json.gz').then(data => data.land || []);
    return landOverviewPromise;
  }
  async function mapPresentation(code) {
    if (overture || !index.mapPresentationPath) return { regions: [], featured: [], schematicLandmarkIds: [] };
    presentationPromise ||= read(index.mapPresentationPath).catch(error => { presentationPromise = null; throw error; });
    return presentationForRegion(await presentationPromise, code, specs.get(code)?.regionCodes);
  }
  async function localRoads(bounds, signal) {
    roadsIndexPromise ||= read(index.metroRoadsPath).catch(error => { roadsIndexPromise = null; throw error; });
    const intersects = b => b && b[2] >= bounds[0] && b[0] <= bounds[2] && b[3] >= bounds[1] && b[1] <= bounds[3];
    const parts = (await roadsIndexPromise).parts.filter(part => intersects(part.bounds)), rows = new Map();
    for (let offset = 0; offset < parts.length; offset += 4) {
      checkViewport(signal);
      const values = await Promise.all(parts.slice(offset, offset + 4).map(async part => {
        let entry = roadCache.get(part.path);
        if (!entry) {
          if (!roadPending.has(part.path)) roadPending.set(part.path, read(part.path).then(value => ({ rows: value.roads, bytes: part.jsonBytes || 0 })).finally(() => roadPending.delete(part.path)));
          entry = await roadPending.get(part.path);
        }
        roadCache.delete(part.path); roadCache.set(part.path, entry);
        let bytes = [...roadCache.values()].reduce((sum, item) => sum + item.bytes, 0);
        for (const [key, item] of roadCache) { if (bytes <= 8 * 1024 * 1024) break; roadCache.delete(key); bytes -= item.bytes; }
        return entry.rows;
      }));
      for (const value of values) for (const road of value) if (intersects(road.b)) rows.set(road.id, road);
    }
    checkViewport(signal); return [...rows.values()];
  }
  // LJ-ADMIN-BOUNDARY-20261030: official leaf polygons and unique complete PBF parent outlines retain their real rings.
  async function adminBoundary(id) {
    const node = admin.nodes.get(id); if (!node?.regionCode) return null;
    const region = await ensure(node.regionCode), land = region.raw.geo?.land || [];
    const own = node.officialCode ? land.filter(part => String(part.code) === String(node.officialCode)) : [];
    const union = parts => parts.reduce((b, part) => [Math.min(b[0], part.b[0]), Math.min(b[1], part.b[1]), Math.max(b[2], part.b[2]), Math.max(b[3], part.b[3])], [Infinity, Infinity, -Infinity, -Infinity]);
    if (own.length) return { id, regionCode: node.regionCode, b: union(own), d: own.map(part => part.d).join(' '), source: 'MLIT-N03-2026' };
    const codes = new Set([...admin.nodes.values()].filter(child => child.adminPath?.includes(id) && child.officialCode).map(child => String(child.officialCode)));
    const children = land.filter(part => codes.has(String(part.code)));
    if (!children.length || !['city', 'prefecture'].includes(node.kind)) return null;
    const b = union(children), intersects = box => !box || !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]);
    const level = node.kind === 'prefecture' ? 4 : 7, matches = new Map();
    const names = new Set([node.nameJa || node.name, ...(node.kind === 'prefecture' && node.regionCode === '13' ? ['東京'] : [])]);
    for (const part of specs.get(node.regionCode)?.overlayParts || []) {
      if (part.level !== 'detail' || !intersects(part.bounds)) continue;
      for (const boundary of (await overlayBlock(part)).boundaries || []) {
        if (names.has(boundary.n) && Number(boundary.adminLevel) === level && boundary.d && intersects(boundary.b)) matches.set(boundary.id, boundary);
      }
    }
    if (matches.size !== 1) return null;
    const shape = [...matches.values()][0];
    return { id, regionCode: node.regionCode, b: shape.b, d: shape.d, source: shape.source, sourceId: shape.id };
  }
  function makeEntity(row, code, cats) {
    const node = admin.resolve(code, row[5]), path = admin.pathFor(node), category = TYPE_NAMES[cats[row[2]]] || '地点';
    return { id: mapPointId(row), name: row[3], aliases: row[4] || [], type: category, categoryCode: cats[row[2]], subtype: row[7] || '', regionCode: code,
      adminPath: path, adminNodes: admin.details(path), coordinates: coordinatesAt(row[0], row[1], projection), address: row[6] || '',
      source: { namespace: row[10], databaseId: row[8], version: index.mapVersion || '3.0.0', reference: 'data/national/sources.json' },
      legacyPlaceId: null, packageIds: [], bodyStatus: 'empty', access: row[9] || 'unknown' };
  }
  function storeEntity(store, code) {
    code = store.regionCode || code;
    const node = admin.resolve(code, store.city), path = admin.pathFor(node);
    const coordinates = Number.isFinite(store.longitude) && Number.isFinite(store.latitude) ? { longitude: store.longitude, latitude: store.latitude, method: 'clothing-source' } : null;
    return { id: `clothing:${store.id}`, name: store.name, aliases: store.aliases || [], type: '服装店', regionCode: code,
      adminPath: path, adminNodes: admin.details(path), coordinates, source: { namespace: 'clothing-v1.3.0', id: store.id, url: store.source, checkedAt: store.checkedAt, otherSources: store.otherSources || [] },
      legacyPlaceId: null, packageIds: [], bodyStatus: 'empty', brandIds: store.brandIds || [], address: store.verifiedAddress || store.address,
      addressQuality: store.addressQuality || null, originalAddress: store.address, addressEvidence: store.addressVerificationSources || store.addressSource || null,
      temporaryNote: store.temporaryNote || null };
  }
  function stationEntity(station, code) {
    return { id: `rail:${station.id}`, name: station.n, aliases: station.ja && station.ja !== station.n ? [station.ja] : [], type: '车站', regionCode: code,
      adminPath: [], adminNodes: [], coordinates: { ...coordinatesAt(station.x, station.y, projection), ...(Number.isFinite(station.longitude) ? { longitude: station.longitude, latitude: station.latitude, method: 'MLIT N02-25' } : {}) },
      source: { namespace: 'MLIT-N02-25', id: station.id, date: station.date, group: station.group }, legacyPlaceId: null, packageIds: [], bodyStatus: 'empty' };
  }
  async function ensure(code) {
    code = regionKey(code);
    if (cache.has(code)) { const r = cache.get(code); cache.delete(code); cache.set(code, r); return r; }
    if (pending.has(code)) return pending.get(code);
    if (!specs.has(code)) throw new Error(`没有地区分包：${code}`);
    const request = loadQueue.then(async () => {
      const start = at(), spec = specs.get(code);
      const [raw, storeData, schematic, presentation] = await Promise.all([spec.available === false ? {region:{defaultBounds:spec.bounds || [0,0,1600,1000]}} : read(spec.mapPath), !canonical && spec.storesPath ? read(spec.storesPath) : { stores: [] }, !overture && code === 'metro' && index.schematicMetroPath ? read(index.schematicMetroPath) : null, mapPresentation(code)]);
      const fetchedAt = at();
      const stores = (storeData.stores || []).map(s => storeEntity(s, code));
      const stations = (raw.transport?.stations || []).map(s => stationEntity(s, code));
      const tolerance = code === '00' ? 8 : 1;
      const map = { bounds: raw.geo?.bounds || raw.region?.defaultBounds, defaultBounds: raw.region?.defaultBounds || raw.geo?.bounds, schematic: overture ? null : schematic || raw.schematic || null, presentation,
        land: (raw.geo?.land || []).map(g => ({ n: g.n, code: g.code, b: g.b, d: simplifyPath(g.d, tolerance) })),
        rivers: (raw.geo?.rivers || []).map(g => ({ n: g.n, w: g.w, d: simplifyPath(g.d, tolerance) })),
        parks: (raw.geo?.parkPolys || []).map(g => ({ n: g.n, d: g.d, x: g.x, y: g.y, a: g.a })),
        labels: raw.geo?.labels || [],
        railways: (raw.transport?.railways || []).map(g => ({ n: g.n, c: g.c, d: simplifyPath(g.d, tolerance) })),
        pbfRailways: spec.overlayCoverage?.railwaysComplete === true && Boolean(spec.overlayParts?.length) };
      const region = { code, raw, stores, stations, map, metrics: { fetchDecodeMs: +(fetchedAt - start).toFixed(1), prepareMs: +(at() - fetchedAt).toFixed(1), rawBytes: spec.jsonBytes || 0 } };
      cache.set(code, region);
      const cachedBytes = () => [...cache.values()].reduce((n, r) => n + (r.metrics.rawBytes || 0), 0);
      while (cache.size > 1 && (cache.size > maxRegions || cachedBytes() > maxDecodedBytes)) cache.delete(cache.keys().next().value);
      return region;
    });
    loadQueue = request.then(() => undefined, () => undefined);
    pending.set(code, request);
    try { return await request; } finally { pending.delete(code); }
  }
  const rowMatches = (row, cats, query) => {
    const type = TYPE_NAMES[cats[row[2]]] || '地点';
    return entityMatches({ id: mapPointId(row), name: row[3], aliases: row[4] || [], type: isRailType(type, row[7]) ? '车站' : type, subtype: row[7] }, query);
  };
  const entityMatches = (e, query) => { const shown = presentStation(e); return normalize([shown.name, e.name, ...(e.aliases || []), ...(shown.searchAliases || []), e.type, shown.displayType, e.subtype, ...browseTypes(e.type, e.subtype)].join(' ')).includes(query); };
  async function search(query, { regionCode = '00', limit = 100, entityIds, requestScope, requestVersion } = {}) {
    if (canonical) {
      let controller;
      if (requestScope) {
        if (Number.isFinite(requestVersion) && requestVersion < (searchVersions.get(requestScope) || 0)) return [];
        cancelSearch(requestScope, requestVersion); controller = new AbortController(); searchJobs.set(requestScope, controller);
      }
      try { return await canonical.search(query, { regionCode, limit, entityIds, signal: controller?.signal }); }
      catch (error) { if (error.name === 'AbortError') return []; throw error; }
      finally { if (controller && searchJobs.get(requestScope) === controller) searchJobs.delete(requestScope); }
    }
    const allowed = Array.isArray(entityIds) ? new Set(entityIds) : null;
    if (allowed?.size === 0) return [];
    const region = await ensure(regionCode), q = normalize(query).trim(), found = [], start = at();
    if (!q) return found;
    const max = Math.min(Math.max(limit, 1), 500), cats = region.raw.poi?.cats || '';
    for (const e of [...region.stores, ...region.stations]) if ((!allowed || allowed.has(e.id)) && entityMatches(e, q)) { found.push(e); if (found.length >= max) return found; }
    for await (const rows of pointRows(region)) {
      for (const row of rows) if ((!allowed || allowed.has(mapPointId(row))) && rowMatches(row, cats, q)) { found.push(makeEntity(row, region.code, cats)); if (found.length >= max) break; }
      if (found.length >= max) break;
    }
    if (found.length < max) for await (const rows of pbfRows(region)) {
      for (const row of rows) if ((!allowed || allowed.has(row.id)) && entityMatches(row, q)) { found.push(pbfEntity(row, region.code)); if (found.length >= max) break; }
      if (found.length >= max) break;
    }
    if (region.code === 'metro' && found.length < max) {
      const seen = new Set(found.map(e => e.id));
      for (const code of specs.get('metro')?.regionCodes || []) {
        for (const e of await search(query, { regionCode: code, limit: max - found.length, entityIds })) if (!seen.has(e.id)) { found.push(e); seen.add(e.id); }
        if (found.length >= max) break;
      }
    }
    region.metrics.lastSearchMs = +(at() - start).toFixed(1);
    return found;
  }
  async function children(id, { offset = 0, limit = 100, regionCode } = {}) {
    if (canonical) return canonical.children(id, { offset, limit, regionCode, all: true });
    const node = admin.nodes.get(id), code = regionKey(regionCode || node?.regionCode), region = await ensure(code);
    const found = [], end = Math.max(0, offset) + Math.min(500, Math.max(1, limit)); let seen = 0;
    const belongs = e => e.adminPath.at(-1) === id;
    for (const entity of region.stores) if (belongs(entity)) { if (seen++ >= offset) found.push(entity); if (seen >= end) return found; }
    const cats = region.raw.poi?.cats || '', nameNodes = new Map();
    for await (const rows of pointRows(region, part => id !== unassignedId && (!part.municipalities || part.municipalities.some(name => admin.resolve(code, name)?.id === id)))) {
      for (const row of rows) {
        if (!nameNodes.has(row[5])) nameNodes.set(row[5], admin.resolve(code, row[5])?.id);
        if (nameNodes.get(row[5]) === id) { if (seen++ >= offset) found.push(makeEntity(row, code, cats)); }
        if (seen >= end) break;
      }
      if (seen >= end) break;
    }
    return found;
  }
  async function visitBrowseItems(id, { regionCode, entityIds, excludedIds = [] } = {}, visitor) {
    const allowed = Array.isArray(entityIds) ? new Set(entityIds) : null;
    const excluded = new Set(excludedIds);
    if (allowed?.size === 0) return;
    const code = regionKey(regionCode || admin.nodes.get(id)?.regionCode), region = await ensure(code);
    for (const entity of region.stores) if (id !== unassignedId && entity.adminPath.at(-1) === id && !excluded.has(entity.id) && (!allowed || allowed.has(entity.id))) {
      if (visitor(entity.type, entity.subtype, () => entity, () => entity.id) === false) return;
    }
    const cats = region.raw.poi?.cats || '', nameNodes = new Map();
    for await (const rows of pointRows(region, part => id !== unassignedId && (!part.municipalities || part.municipalities.some(name => admin.resolve(code, name)?.id === id)))) {
      for (const row of rows) {
        if (!nameNodes.has(row[5])) nameNodes.set(row[5], admin.resolve(code, row[5])?.id);
        if (nameNodes.get(row[5]) !== id || excluded.has(mapPointId(row)) || (allowed && !allowed.has(mapPointId(row)))) continue;
        if (visitor(TYPE_NAMES[cats[row[2]]] || '地点', row[7], () => makeEntity(row, code, cats), () => mapPointId(row)) === false) return;
      }
    }
    for await (const rows of pbfRows(region, part => id === unassignedId ? unassignedPart(part) : !part.adminNodeIds || part.adminNodeIds.includes(id))) {
      for (const row of rows) {
        if ((id === unassignedId ? row.adminNodeId != null : row.adminNodeId !== id) || excluded.has(row.id) || (allowed && !allowed.has(row.id))) continue;
        if (visitor(row.type, row.subtype, () => pbfEntity(row, region.code), () => row.id) === false) return;
      }
    }
  }
  async function geographicNodes(code) {
    if (canonical) return canonical.geographicNodes(code);
    const nodes = new Map(), region = await ensure(code);
    const save = entity => nodes.set(entity.id, { ...entity, adminNodeId: entity.adminNodeId || entity.adminPath?.at(-1) || null,
      parents: (entity.containedBy || []).map(id => ({ id, regionCode: entity.regionCode })) });
    for (const node of admin.nodes.values()) if (node.regionCode === code) await visitBrowseItems(node.id, { regionCode: code }, (_type, _subtype, make) => { save(make()); });
    if (code === '00') await visitBrowseItems(unassignedId, { regionCode: code }, (_type, _subtype, make) => { save(make()); });
    for (const group of await facilityGroups(code)) {
      if (!group.entityId) continue;
      if (group.entityRef) save(group.entityRef);
      for (const ref of group.memberRefs || []) {
        const row = nodes.get(ref.id) || ref;
        nodes.set(ref.id, { ...row, adminNodeId: row.adminNodeId || group.adminNodeId,
          parents: [...(row.parents || []), { id: group.entityId, regionCode: group.regionCode }] });
      }
    }
    return { nodes: [...nodes.values()] };
  }
  async function resolve(id, { regionCode = '00', path } = {}) {
    if (canonical) return canonical.resolve(id);
    const region = await ensure(regionCode);
    if (id.startsWith('osm:')) {
      const [, osmType, number] = id.split(':'), osmId = Number(number);
      for await (const rows of pbfRows(region, part => {
        if (path) return part.path === path;
        const range = part.idRanges?.[osmType];
        return !part.idRanges || (range && osmId >= range[0] && osmId <= range[1]);
      })) { const row = rows.find(row => row.id === id); if (row) return pbfEntity(row, region.code); }
      return null;
    }
    const e = region.stores.find(e => e.id === id) || region.stations.find(e => e.id === id); if (e) return e;
    const cats = region.raw.poi?.cats || '';
    for await (const rows of pointRows(region)) for (const row of rows) if (mapPointId(row) === id) return makeEntity(row, region.code, cats);
    return null;
  }
  async function viewportRows(code, bounds, { limit = 700, detail = 'standard', mode = 'detail', focusRegionCode, scale = 800 / Math.max(1, bounds[2] - bounds[0]), includeOverlays = true, pointVisibility, signal } = {}) {
    const region = await ensure(code), [minX, minY, maxX, maxY] = bounds, result = [], bins = new Set();
    checkViewport(signal);
    const max = Math.min(1200, Math.max(50, limit)), cats = region.raw.poi?.cats || '', visibility = normalizeMapPointVisibility(pointVisibility);
    const policy = mapLevelPolicy(mode, scale), presentation = region.map.presentation;
    // LJ-MAP-CLOSE-COMPLETE-20261101: close ultra views keep every eligible point inside the real viewport.
    const completeNearView = mode === 'ultra' && policy.close;
    const anchors = [...presentation.regions, ...(policy.featured ? presentation.featured : [])].filter(row => {
      const point = projectCoordinates(row.displayAnchorCoordinates || row.coordinates, projection);
      return point && point[0] >= minX && point[0] <= maxX && point[1] >= minY && point[1] <= maxY && (row.mapRole === 'region' || isMapPointVisible(row, visibility));
    });
    if (canonical) anchors.push(...await canonical.livingAreas(region.code, bounds));
    // LJ-MAP-STABLE-POINTS-01: nested geographic cells retain representatives while panning.
    const spanX = Math.max(0.0001, maxX - minX), spanY = Math.max(0.0001, maxY - minY);
    let cell = 2 ** Math.ceil(Math.log2(Math.sqrt(spanX * spanY / max)));
    while ((Math.ceil(spanX / cell) + 2) * (Math.ceil(spanY / cell) + 2) > max) cell *= 2;
    const grid = [Math.floor(minX / cell), Math.floor(minY / cell), Math.floor(maxX / cell), Math.floor(maxY / cell)];
    const scan = [grid[0] * cell, grid[1] * cell, (grid[2] + 1) * cell, (grid[3] + 1) * cell];
    const consider = (x, y, make) => {
      if (completeNearView) {
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) result.push(make());
        return;
      }
      const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
      if (gx < grid[0] || gx > grid[2] || gy < grid[1] || gy > grid[3]) return;
      const key = `${gx},${gy}`;
      if (bins.has(key)) return; bins.add(key);
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) result.push(make());
    };
    if (canonical) {
      if (policy.stations || policy.ordinary) await canonical.viewport(region.code, scan, { mode: policy.ordinary ? 'ultra' : 'detail', visible: row => isMapPointVisible(row, visibility), consider, signal });
    } else {
      if (policy.stations) for (const station of region.stations) consider(station.coordinates.x, station.coordinates.y, () => station);
      if (policy.ordinary) {
      for (const store of region.stores) { if (!isMapPointVisible(store, visibility)) continue; const xy = projectCoordinates(store.coordinates, projection); if (xy) consider(...xy, () => store); }
      for await (const rows of pointRows(region, part => !part.bounds || !(part.bounds[2] < scan[0] || part.bounds[0] > scan[2] || part.bounds[3] < scan[1] || part.bounds[1] > scan[3]))) {
        for (const row of rows) { if (!isMapPointVisible({ categoryCode: cats[row[2]], subtype: row[7] }, visibility)) continue; consider(row[0], row[1], () => makeEntity(row, region.code, cats)); if (!completeNearView && result.length >= max) break; }
        if (!completeNearView && result.length >= max) break;
      }
      for await (const rows of pbfRows(region, part => part.spatial !== false && (!part.bounds || !(part.bounds[2] < scan[0] || part.bounds[0] > scan[2] || part.bounds[3] < scan[1] || part.bounds[1] > scan[3])))) {
        for (const row of rows) { if (!isMapPointVisible(row, visibility)) continue; const xy = projectCoordinates(row.coordinates, projection); if (xy) consider(...xy, () => pbfEntity(row, region.code)); if (!completeNearView && result.length >= max) break; }
        if (!completeNearView && result.length >= max) break;
      }
      }
    }
    let roads = mode === 'ultra' && (maxX - minX) < 250 ? (region.raw.roads || []).filter(r => !r.b || !(r.b[2] < minX || r.b[0] > maxX || r.b[3] < minY || r.b[1] > maxY)).slice(0, 160).map(r => ({ d: r.d, k: r.k })) : [];
    if (index.metroRoadsPath && ['metro', '11', '12', '13', '14'].includes(region.code) && policy.ordinary && maxX - minX < 250) roads = await localRoads(bounds, signal);
    if (!canonical && region.code === 'metro' && mode === 'ultra' && maxX - minX < 900) {
      const center = [(minX + maxX) / 2, (minY + maxY) / 2], covered = specs.get('metro')?.coverage || [];
      const target = covered.find(r => r.code === focusRegionCode) || covered.filter(r => center[0] >= r.bounds[0] && center[0] <= r.bounds[2] && center[1] >= r.bounds[1] && center[1] <= r.bounds[3]).sort((a, b) => (a.bounds[2] - a.bounds[0]) * (a.bounds[3] - a.bounds[1]) - (b.bounds[2] - b.bounds[0]) * (b.bounds[3] - b.bounds[1]))[0];
      if (target) { const finer = await viewportRows(target.code, bounds, { limit, detail, mode, scale, includeOverlays: false, pointVisibility: visibility, signal }); for (const entity of finer.entities) { const xy = projectCoordinates(entity.coordinates, projection); if (xy) consider(...xy, () => entity); } roads = finer.roads; }
    }
    checkViewport(signal);
    const overlays = includeOverlays ? await overlaysFor(region.code, bounds, mode, scale, signal) : null;
    checkViewport(signal);
    const entities = deduplicateMapPoints([...anchors, ...result]);
    return { entities, roads, count: entities.length, overlays };
  }
  async function viewport(code, bounds, options = {}) {
    const { requestScope, requestVersion, ...view } = options;
    const empty = () => ({ entities: [], roads: [], count: 0, overlays: null });
    let controller;
    if (requestScope) {
      if (Number.isFinite(requestVersion) && requestVersion < (viewportVersions.get(requestScope) || 0)) return empty();
      cancelViewport(requestScope, requestVersion); controller = new AbortController(); viewportJobs.set(requestScope, controller);
    }
    const key = JSON.stringify([code, bounds, view]);
    try {
      if (lastViewport?.key === key) return lastViewport.value;
      const value = await viewportRows(code, bounds, { ...view, signal: controller?.signal });
      checkViewport(controller?.signal); lastViewport = { key, value }; return value;
    } catch (error) { if (error.name === 'AbortError') return empty(); throw error; }
    finally { if (controller && viewportJobs.get(requestScope) === controller) viewportJobs.delete(requestScope); }
  }
  return { async loadRegion(code) { const r = await ensure(code); return { code: r.code, map: r.map, poiCount: overture ? (specs.get(r.code)?.poiCount || 0) : (specs.get(r.code)?.poiCount || r.raw.poi?.list?.length || 0) + (specs.get(r.code)?.pbfParts || []).reduce((n, part) => n + (part.count || 0), 0), storeCount: r.stores.length, metrics: { ...r.metrics, cachedRegions: [...cache.keys()], cachedPointBlocks: pointCache.size } }; }, search, cancelSearch, startMapSearch, startTextSearch,
    textSearchPage: (queryId, options) => textSearch.page(queryId, options), textSearchStats: () => textSearch?.stats() || {},
    mapSearchPage: (queryId, options) => { if (!mapSearch) throw new Error('当前目录没有可用的标准地点搜索索引'); return mapSearch.page(queryId, options); }, mapSearchStats: () => mapSearch?.stats() || {},
    children, resolve, viewport, facilityGroups, landOverview, adminBoundary,
    geographicNodes, geographicRead: read, geographicResolve: ref => canonical?.resolveReference(ref), geographicLookup: id => canonical?.resolveLight(id),
    canonicalResolve: id => canonical?.resolve(id) || null, canonicalResolveLight: id => canonical?.resolveLight(id) || null,
    canonicalResolveLights: ids => canonical?.resolveLights(ids) || [],
    activationCandidates: texts => canonical?.activationCandidates(texts) || [], nearby: (entity, options) => canonical?.nearby(entity, options) || [], cancelViewport,
    clear() { for (const scope of searchJobs.keys()) cancelSearch(scope); for (const scope of viewportJobs.keys()) cancelViewport(scope); mapSearch?.clear(); textSearch?.clear(); lastViewport = null; canonical?.clear(); cache.clear(); pointCache.clear(); roadCache.clear(); roadsIndexPromise = null; facilityFiles.clear(); landOverviewPromise = null; overlayCache.clear(); overviewSummary = null; }, stats() { return { cachedRegions: [...cache.keys()], pendingRegions: [...pending.keys()], cachedPointBlocks: pointCache.size, cachedOverlayBlocks: overlayCache.size, cachedOverlayBytes: overlayBytes(), cachedOverlayViewBytes: overviewSummary?.bytes || 0, cachedOverviewBytes: overviewSummary?.value.level === 'overview' ? overviewSummary.bytes : 0 }; } };
}

function workerClient(index, baseUrl, stationNames, placeMetadata, packSnapshot, onSearchUpdate = () => {}) {
  const worker = new Worker(new URL('./national-worker.js', import.meta.url), { type: 'module', name: 'Living Japan 全国资料' });
  let sequence = 0; const pending = new Map();
  worker.onmessage = ({ data }) => { if (data.event === 'map-search-update') { onSearchUpdate(data.update); return; } const request = pending.get(data.id); if (!request) return; pending.delete(data.id); data.error ? request.reject(new Error(data.error)) : request.resolve(data.result); };
  worker.onerror = event => { for (const p of pending.values()) p.reject(new Error(event.message || '全国资料工作线程发生错误')); pending.clear(); };
  const call = (method, ...args) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); worker.postMessage({ id, method, args }); });
  const ready = call('init', { index, baseUrl: String(baseUrl), stationNames, placeMetadata, packSnapshot, metroNames: currentMetroNames() });
  return { ready, call: async (method, ...args) => { await ready; return call(method, ...args); }, destroy() { worker.terminate(); for (const p of pending.values()) p.reject(new Error('资料已关闭')); pending.clear(); } };
}

export function createCatalog({ baseData = {}, baseUrl, fetcher = globalThis.fetch, useWorker = true, packSnapshot } = {}) {
  const entities = new Map(), baselineIds = new Set(), regionViews = new Map(), loaded = new Map();
  const builtinEntities = new Map();
  let personalState = { placeEdits: normalizePlaceEdits() }, editSignature = '';
  const projectPersonal = entity => applyPlaceEdit(entity, personalState);
  let regionSelections = new Map();
  const districts = new Map();
  const district = id => districts.get(displayRepresentativeId(typeof id === 'string' ? id : id?.id));
  // LJ-PRIVATE-PLACE-20261030: retired public points remain accessible only from saved personal snapshots.
  const personalPlaces = new Map();
  const canonicalIds = new Map(), resolvedOldIds = new Set(), searchVersions = new Map();
  const nextSearchVersion = scope => { const version = (searchVersions.get(scope) || 0) + 1; searchVersions.set(scope, version); return version; };
  const searchListeners = new Map();
  function presentSearchPage(snapshot) {
    if (!snapshot?.items) return snapshot;
    return { ...snapshot, items: snapshot.items.map(item => {
      const source = item.entity || item, coordinates = Array.isArray(source.coordinates) ? { longitude: source.coordinates[0], latitude: source.coordinates[1] } : source.coordinates;
      const entity = remember(coordinates === source.coordinates ? source : { ...source, coordinates });
      return entity ? { ...item, ...createSearchResultItem(entity), coordinates: entity.coordinates || null } : item;
    }) };
  }
  const publishSearchUpdate = event => { const listener = searchListeners.get(event.requestScope); if (listener?.version === event.requestVersion && listener.version === searchVersions.get(event.requestScope)) listener.onUpdate?.({ ...event, result: presentSearchPage(event.result) }); };
  const viewportVersions = new Map();
  const nextViewportVersion = scope => { const version = (viewportVersions.get(scope) || 0) + 1; viewportVersions.set(scope, version); return version; };
  const navigationRoot = 'navigation:root', navigation = new Map(), groupByRegion = new Map();
  // LJ-BROWSE-PERF-20261101: index direct administration once; refresh supplements only after their data changes.
  const administrativeIds = [], administrativeChildren = new Map(), directGeographicCounts = new Map();
  let directory, directoryRefresh, supplementVersion = 0, directoryVersion = -1, personalSignature = '[]';
  const facilities = createFacilityGroups(), facilityRegions = new Map();
  const unassigned = { id: unassignedId, name: '地区待确认', type: '待确认地区', kind: 'browse-unassigned', browseOnly: true, parentId: navigationRoot, regionCode: '00' };
  const hasUnassigned = () => Boolean([...personalPlaces.values()].some(entity => resolvedOldIds.has(entity.id) && personalParent(entity) === unassignedId) || (index?.canonicalPlaces ? index.canonicalPlaces.parts.some(part => part.regionCodes?.includes('00')) : index?.regions?.find(region => region.code === '00')?.pbfParts?.some(unassignedPart)));
  let index, admin, loading, remote, local, activeCode = '00';
  const basePackages = new Map((baseData.packages || []).map(p => [p.id, p]));
  function personalParent(entity) {
    return [entity.adminNodeId, ...(entity.adminPath || []).slice().reverse()].find(id => admin?.nodes.has(id)) || unassignedId;
  }
  function setPersonalPlaces(container = {}) {
    const nextEdits = normalizePlaceEdits(container.placeEdits), nextSignature = JSON.stringify(nextEdits);
    if (nextSignature !== editSignature) {
      personalState = { placeEdits: nextEdits }; editSignature = nextSignature; supplementVersion++;
      for (const [id, row] of builtinEntities) entities.set(id, projectPersonal(row));
      for (const [id, row] of Object.entries(nextEdits.created)) entities.set(id, projectPersonal({ id, kind: 'content_object', canonicalPlace: true, personalPlace: true, userCreated: true, packageIds: [placeEditPackageId(id)], ...row }));
      for (const [id, row] of entities) if (row.userCreated && !Object.hasOwn(nextEdits.created, id)) entities.delete(id);
    }
    const snapshots = new Map(), packages = new Map(), nextPlaces = new Map();
    for (const slot of Object.values(container.customSlots || {})) {
      if (!slot?.entityId || isRetiredLivingArea(slot.entityId)) continue;
      snapshots.set(slot.entityId, { ...slot, id: slot.entityId });
      if (!packages.has(slot.entityId)) packages.set(slot.entityId, []);
      packages.get(slot.entityId).push('LJ_USER_' + encodeURIComponent(slot.id));
    }
    for (const [id, row] of Object.entries(container.materialLibrary?.places || {})) snapshots.set(id, { ...snapshots.get(id), ...row, id });
    const fields = ['id', 'name', 'shortName', 'originalName', 'originalNames', 'activationName', 'aliases', 'searchAliases', 'fullNames', 'chainBrand', 'chainBrandAliases', 'chainNameSource', 'chainSearchOnlyNames', 'type', 'subtype', 'regionCode', 'adminNodeId', 'adminPath', 'adminNodes', 'coordinates', 'summary', 'legacyPlaceId', 'climateRegionId'];
    for (const [id, row] of snapshots) {
      if (!row.name || isRetiredLivingArea(row)) continue;
      const entity = Object.fromEntries(fields.filter(key => row[key] !== undefined).map(key => [key, row[key]]));
      entity.adminPath = (row.adminPath || []).map(node => typeof node === 'string' ? node : node.id).filter(Boolean);
      entity.adminNodes = row.adminNodes || admin?.details(entity.adminPath) || [];
      entity.regionCode ||= entity.adminPath.map(id => admin?.nodes.get(id)?.regionCode).find(Boolean) || null;
      nextPlaces.set(id, presentCatalogEntity({ ...entity, type: row.type || '具名地点', aliases: row.aliases || [], personalPlace: true, packageIds: packages.get(id) || [], bodyStatus: 'empty' }, baseData));
    }
    const signature = JSON.stringify([...nextPlaces].sort(([a], [b]) => a.localeCompare(b)));
    if (signature === personalSignature) return;
    for (const [id, entity] of entities) if (entity.personalPlace) entities.delete(id);
    personalPlaces.clear();
    for (const [id, entity] of nextPlaces) personalPlaces.set(id, entity);
    personalSignature = signature;
    supplementVersion++;
  }
  async function personalFallbacks({ query, regionCode, adminNodeId, entityIds, isCurrent = () => true } = {}) {
    const allowed = Array.isArray(entityIds) ? new Set(entityIds) : null;
    const codes = index.views?.find(view => view.code === regionCode)?.regionCodes || [regionCode];
    const result = [];
    for (const snapshot of personalPlaces.values()) {
      if (!isCurrent()) return [];
      if (allowed && !allowed.has(snapshot.id)) continue;
      if (adminNodeId && personalParent(snapshot) !== adminNodeId) continue;
      if (regionCode && regionCode !== '00' && snapshot.regionCode && !codes.includes(snapshot.regionCode)) continue;
      if (query && !matchesSearchFields(supplementFields(snapshot), query, supplementContextFields(snapshot))) continue;
      const entity = await directoryLookup(snapshot.id);
      if (!isCurrent()) return [];
      if (entity?.personalPlace) result.push(entity);
    }
    return result;
  }
  const supplementFields = entity => [entity.name, entity.nameJa, entity.originalName, entity.activationName, entity.shortName,
    ...(entity.aliases || []), ...(entity.searchAliases || []), ...(entity.fullNames || []), ...(entity.chainSearchOnlyNames || []),
    ...(entity.originalNames || []), entity.type, entity.displayType, entity.subtype].filter(Boolean);
  function supplementContextFields(entity) {
    const node = admin.nodes.get(entity.adminNodeId) || entity;
    const path = node.adminPath || entity.adminPath || [];
    const parents = path.map(id => admin.nodes.get(typeof id === 'string' ? id : id.id)).filter(parent => parent && parent.id !== entity.id);
    if (node.id !== entity.id) parents.push(node);
    const group = groupByRegion.get(entity.regionCode);
    if (group && group.id !== entity.id) parents.push(group);
    const container = entities.get(entity.parentId || entity.related?.find(edge => edge.kind === 'within')?.id);
    if (container) parents.push(container);
    return parents.flatMap(supplementFields);
  }
  async function searchSupplements(query, { regionCode, entityIds, limit = Infinity, isCurrent = () => true } = {}) {
    if (!isCurrent()) return [];
    const allowed = Array.isArray(entityIds) ? new Set(entityIds) : null, viewRegions = index.views?.find(v => v.code === regionCode)?.regionCodes;
    const baseline = [...entities.values(), ...navigation.values()].filter(e => ((baselineIds.has(e.id) && !index.canonicalPlaces) || e.kind === 'map-region' && e.id.startsWith('map-region:') || admin.nodes.has(e.id) || navigation.has(e.id)) && (!allowed || allowed.has(e.id)) && (!regionCode || regionCode === '00' || e.regionCode === regionKey(regionCode) || viewRegions?.includes(e.regionCode) || e.regionCodes?.some(code => (viewRegions || [regionKey(regionCode)]).includes(code))) && matchesSearchFields(supplementFields(e), query, supplementContextFields(e))).slice(0, limit);
    if (baseline.length < limit) baseline.push(...(await personalFallbacks({ query, regionCode, entityIds, isCurrent })).slice(0, limit - baseline.length));
    if (!isCurrent()) return [];
    for (const id of Object.keys({ ...personalState.placeEdits.overrides, ...personalState.placeEdits.created })) {
      const entity = await resolveEntity(id);
      if (!isCurrent()) return [];
      if (!entity || allowed && !allowed.has(entity.id) || regionCode && regionCode !== '00' && !(viewRegions || [regionKey(regionCode)]).includes(entity.regionCode)) continue;
      if (matchesSearchFields(supplementFields(entity), query, supplementContextFields(entity)) && !baseline.some(row => row.id === entity.id)) baseline.push(entity);
    }
    return baseline.slice(0, limit).map(entity => ({ id: entity.id, name: entity.name, type: entity.displayType || entity.type, regionCode: entity.regionCode,
      searchSource: navigation.has(entity.id) ? 'navigation' : admin.nodes.has(entity.id) ? 'administration' : entity.kind === 'map-region' ? 'district' : entity.personalPlace ? 'personal' : 'baseline', entity }));
  }
  const byPlace = new Map();
  for (const p of baseData.packages || []) { if (!p.placeId) continue; if (!byPlace.has(p.placeId)) byPlace.set(p.placeId, []); byPlace.get(p.placeId).push(p.id); }
  const stationByLegacy = new Map(), railLegacy = new Map();
  for (const s of baseData.stationAdministration?.stations || []) for (const id of s.legacyStationIds || []) stationByLegacy.set(id, s);
  const remember = entity => {
    if (!entity || isRetiredLivingArea(entity) || isHiddenAggregateDisplayPoint(entity)) return null;
    if (isSecondaryDisplayPoint(entity)) return entities.get(displayRepresentativeId(entity.id)) || null;
    entity = applyRegionSelection(sanitizeIdentity(augmentDisplayRepresentative(entity)), regionSelections);
    const complete = entities.get(entity.id);
    if (entity.source?.namespace === 'living-japan-map-presentation') {
      if (entity.mapRole === 'region' && complete) return applyRegionSelection({ ...complete, mapRole: 'region' }, regionSelections);
      entity = { ...entity, canonicalPlace: true, ...(entity.kind === 'map-region' ? {} : { canonicalIndexOnly: true }) };
    }
    if (entity.canonicalIndexOnly && complete?.canonicalPlace && !complete.canonicalIndexOnly) return applyRegionSelection(complete, regionSelections);
    if (entity.canonicalPlace) {
      const sourceIds = [...new Set([entity.id, ...(entity.allSourceIds || entity.sourceIds || []), entity.legacyPlaceId].filter(Boolean))];
      const packageIds = [...new Set([...(entity.packageIds || []), ...sourceIds.flatMap(id => byPlace.get(id) || [])])].filter(id => !baseData.runtimeTextManifest || basePackages.has(id) || id.startsWith('LJ_USER_') || id.startsWith('LJ_MATERIAL_'));
      const legacyPlaceId = entity.legacyPlaceId || sourceIds.find(id => baselineIds.has(id));
      entity = { ...entity, allSourceIds: sourceIds, packageIds, ...(legacyPlaceId ? { legacyPlaceId } : {}), bodyStatus: packageIds.some(id => (basePackages.get(id)?.hasBody || String(basePackages.get(id)?.body || '').trim())) ? 'builtin' : entity.bodyStatus || 'empty' };
      for (const id of sourceIds) canonicalIds.set(id, entity.id);
    }
    const legacy = entity.type === '车站' && railLegacy.get(`n02_station_${entity.source?.group}`);
    if (legacy) entity = { ...entity, legacyPlaceId: legacy.id, packageIds: legacy.packageIds, adminPath: legacy.adminPath, adminNodes: legacy.adminNodes, bodyStatus: legacy.bodyStatus };
    if (entity.personalEdited && builtinEntities.has(entity.id)) entity = builtinEntities.get(entity.id);
    entity = presentCatalogEntity(entity, baseData);
    if (!entity.userCreated) builtinEntities.set(entity.id, entity);
    entity = projectPersonal(entity);
    entities.set(entity.id, entity);
    if (entities.size > baselineIds.size + 6000) for (const [id] of entities) { if (!baselineIds.has(id) && !admin?.nodes.has(id)) { entities.delete(id); if (entities.size <= baselineIds.size + 4000) break; } }
    return entity;
  };
  const resolveOfficialPath = names => {
    let parentId = 'admin:jp'; const path = ['admin:jp'];
    for (const name of names || []) {
      const node = [...admin.nodes.values()].find(n => n.parentId === parentId && (n.nameJa === name || n.name === name));
      if (!node) break; path.push(node.id); parentId = node.id;
    }
    return path;
  };
  function addBaseline() {
    for (const place of baseData.places || []) {
      if (isRetiredLivingArea(place) || isSecondaryDisplayPoint(place) || isHiddenAggregateDisplayPoint(place)) continue;
      let path = (place.adminPath || []).filter(id => admin.nodes.has(id));
      if (path.length && path[0] !== 'admin:jp') path.unshift('admin:jp');
      const official = stationByLegacy.get(place.stationId || place.mapStationId);
      if (official?.officialAdminPathsJa?.[0]) path = resolveOfficialPath(official.officialAdminPathsJa[0]);
      const packageIds = byPlace.get(place.placeId) || [], pref = path.map(id => admin.nodes.get(id)).find(n => n?.kind === 'prefecture');
      const objectTypes = baseData.placePresentation?.objectTypes?.[place.sourceObjectId] || [];
      const e = { id: place.placeId, name: place.label, aliases: place.aliases || [], type: place.kind === 'station' ? '车站' : place.kind === 'editorial_area' ? '生活带' : objectTypes.join('／') || '具名地点', kind: place.kind,
        adminPath: path, adminNodes: admin.details(path), coordinates: place.coordinates || null, source: { namespace: 'living-japan-v3.6', objectId: place.sourceObjectId },
        legacyPlaceId: place.placeId, packageIds, regionCode: pref?.regionCode || null, bodyStatus: packageIds.some(id => (basePackages.get(id)?.hasBody || String(basePackages.get(id)?.body || '').trim())) ? 'builtin' : 'empty',
        containedBy: (baseData.locationRelations?.crossObject || []).filter(r => r.kind === 'parent_child' && r.sourceObjectId === place.sourceObjectId).map(r => `place:content_object:${r.targetObjectId}`) };
      const presented = presentCatalogEntity(e, baseData);
      builtinEntities.set(e.id, presented);
      entities.set(e.id, presented); baselineIds.add(e.id);
      if (official) railLegacy.set(official.railStationId, presented);
    }
  }

  async function loadIndex() {
    if (loading) return loading; if (index) return index;
    loading = (async () => {
      const response = await fetcher(nationalUrl(baseUrl, 'manifest.json'));
      if (!response.ok) throw new Error(`全国资料目录读取失败 (${response.status})`);
      index = await response.json(); admin = administration(index);
      administrativeIds.length = 0; administrativeChildren.clear(); directGeographicCounts.clear();
      for (const group of index.navigationRegions || []) {
        const node = { ...group, type: '地理大区', kind: 'navigation-region', browseOnly: true, parentId: navigationRoot };
        navigation.set(node.id, node);
        for (const code of node.regionCodes) groupByRegion.set(code, node);
      }
      for (const node of admin.nodes.values()) {
        entities.set(node.id, { ...node, type: '行政区', aliases: node.aliases || [], coordinates: null, source: node.source || { namespace: 'MLIT-N03-2026' }, packageIds: [], legacyPlaceId: null, bodyStatus: 'empty', adminNodes: admin.details(node.adminPath || []) });
        if (node.id === 'admin:jp') continue;
        administrativeIds.push(node.id);
        if (!administrativeChildren.has(node.parentId)) administrativeChildren.set(node.parentId, []);
        administrativeChildren.get(node.parentId).push(node.id);
      }
      for (const part of index.canonicalPlaces?.geographicIndex?.parts || []) for (const [id, count] of Object.entries(part.adminCounts || {})) directGeographicCounts.set(id, (directGeographicCounts.get(id) || 0) + count);
      if (index.runtimeSource?.kind !== 'overture') addBaseline();
      if (index.runtimeSource?.kind !== 'overture' && index.mapPresentationPath) {
        const response = await fetcher(nationalUrl(baseUrl, index.mapPresentationPath));
        if (!response.ok) throw new Error('地图重点目录读取失败：' + response.status);
        const presentation = await response.json();
        regionSelections = regionSelectionRelations(presentation.regions, presentation.featured);
        baseData.mapRegions = (presentation.regions || []).map(row => applyRegionSelection(row, regionSelections));
        for (const row of baseData.mapRegions) { remember(row); districts.set(row.id, row); }
      }
      const stationNames = buildStationNameRules(baseData);
      if (useWorker && typeof Worker !== 'undefined' && (fetcher === globalThis.fetch || packSnapshot)) { remote = workerClient(index, String(baseUrl || new URL('../', import.meta.url).href), stationNames, baseData.placeMetadata, packSnapshot, publishSearchUpdate); await remote.ready; }
      else local = createRegionService({ index, baseUrl, fetcher, stationNames, placeMetadata: baseData.placeMetadata, onSearchUpdate: publishSearchUpdate });
      return index;
    })();
    try { return await loading; } catch (error) { index = null; loading = null; throw error; }
  }
  const run = async (method, ...args) => { await loadIndex(); return remote ? remote.call(method, ...args) : local[method](...args); };
  async function loadRegion(code) {
    await loadIndex(); code = regionKey(code); activeCode = code;
    if (!loaded.has(code)) loaded.set(code, run('loadRegion', code).catch(error => { loaded.delete(code); throw error; }));
    const view = await loaded.get(code); regionViews.delete(code); regionViews.set(code, view);
    while (regionViews.size > 2) { const old = regionViews.keys().next().value; regionViews.delete(old); loaded.delete(old); }
    return view;
  }
  async function search(query, { regionCode = activeCode, limit = 100, entityIds, requestScope } = {}) {
    const requestVersion = requestScope ? nextSearchVersion(requestScope) : undefined;
    await loadIndex(); const q = String(query || '').trim();
    if (!q) { if (requestScope) await run('cancelSearch', requestScope, requestVersion); return []; }
    const max = Math.min(500, Math.max(1, limit)), allowed = Array.isArray(entityIds) ? new Set(entityIds) : null;
    if (allowed?.size === 0) { if (requestScope) await run('cancelSearch', requestScope, requestVersion); return []; }
    const baseline = (await searchSupplements(q, { regionCode, entityIds, limit: max })).map(item => item.entity);
    if (baseline.length >= max || !index.regions?.length) { if (requestScope) await run('cancelSearch', requestScope, requestVersion); return baseline; }
    const found = await run('search', q, { regionCode, limit: max - baseline.length, entityIds, requestScope, requestVersion, excludedIds: Object.keys(personalState.placeEdits.overrides) });
    return [...new Map([...baseline, ...found.map(remember).filter(Boolean)].map(row => [row.id, row])).values()].slice(0, max);
  }
  async function startSearchSession(method, query, { regionCode = activeCode, requestScope, pageSize, entityIds, onUpdate, ...options }) {
    const requestVersion = nextSearchVersion(requestScope);
    searchListeners.set(requestScope, { version: requestVersion, onUpdate });
    await loadIndex();
    const isCurrent = () => searchVersions.get(requestScope) === requestVersion;
    if (!isCurrent()) return { cancelled: true, requestVersion };
    const supplemental = await searchSupplements(String(query || '').trim(), { regionCode, entityIds, isCurrent });
    if (!isCurrent()) return { cancelled: true, requestVersion };
    const supplementalSignature = JSON.stringify(supplemental.slice().sort((a, b) => a.id.localeCompare(b.id)));
    return run(method, query, { ...options, regionCode, requestScope, requestVersion, pageSize, supplemental, supplementalSignature, entityIds, excludedIds: Object.keys(personalState.placeEdits.overrides) });
  }
  const startMapSearch = (query, { regionCode = activeCode, priorityBounds = null, requestScope = 'map-search', pageSize = 40, entityIds, onUpdate } = {}) =>
    startSearchSession('startMapSearch', query, { regionCode, priorityBounds, requestScope, pageSize, entityIds, onUpdate });
  const startTextSearch = (query, { regionCode = activeCode, requestScope = 'browse-search', pageSize = 48, entityIds, onUpdate } = {}) =>
    startSearchSession('startTextSearch', query, { regionCode, requestScope, pageSize, entityIds, onUpdate });
  async function ensureFacilities(code) {
    if (!code || index.canonicalPlaces) return;
    code = regionKey(code);
    if (!facilityRegions.has(code)) facilityRegions.set(code, run('facilityGroups', code).then(groups => { for (const group of groups) facilities.add(group); }).catch(error => { facilityRegions.delete(code); throw error; }));
    await facilityRegions.get(code);
  }
  const browseEntryId = entity => canonicalIds.get(entity?.id) || displayRepresentativeId(entity?.id);
  async function resolveEntity(id, options = {}) {
    if (!id || isRetiredLivingArea(id) || isHiddenAggregateDisplayPoint(id)) return null;
    id = displayRepresentativeId(id);
    await loadIndex();
    if (Object.hasOwn(personalState.placeEdits.created, id)) return entities.get(id) || projectPersonal({ id, ...personalState.placeEdits.created[id], canonicalPlace: true, userCreated: true });
    if (admin.nodes.has(id) || navigation.has(id) || districts.has(id) || id === unassignedId) return getEntity(id);
    if (index.canonicalPlaces) {
      const cached = entities.get(canonicalIds.get(id) || id);
      if (cached?.canonicalPlace && !cached.canonicalIndexOnly && !cached.personalPlace) return cached;
      const resolved = await run('canonicalResolve', id);
      if (resolved) return remember(resolved);
      resolvedOldIds.add(id);
      return personalPlaces.get(id) || (baselineIds.has(id) ? entities.get(id) : null);
    }
    const existing = entities.get(id) || personalPlaces.get(id);
    return existing || remember(await run('resolve', id, { regionCode: options.regionCode || activeCode, ...options }));
  }
  async function directoryLookup(id) {
    const own = entities.get(canonicalIds.get(id) || id) || navigation.get(id) || districts.get(id);
    if (own && (!index.canonicalPlaces || own.canonicalPlace || own.type === '行政区' || own.browseOnly || districts.has(id))) return own;
    const row = index.canonicalPlaces ? await run('geographicLookup', id) : await resolveEntity(id);
    if (row) return remember(row);
    resolvedOldIds.add(id);
    return personalPlaces.get(id) || null;
  }
  async function directorySupplements() {
    const personal = await personalFallbacks(), nodes = [];
    for (const group of navigation.values()) nodes.push({ ...group, isNavigation: true, parents: [{ id: navigationRoot }] });
    for (const entity of adminChildrenAll()) {
      const parentId = entity.parentId === 'admin:jp' ? groupByRegion.get(entity.regionCode)?.id || navigationRoot : entity.parentId || navigationRoot;
      const childCount = (directGeographicCounts.get(entity.id) || 0) + (administrativeChildren.get(entity.id)?.length || 0);
      nodes.push({ ...entity, isAdministrative: true, childCount, parents: [{ id: parentId, regionCode: entity.regionCode }] });
    }
    if (hasUnassigned()) nodes.push({ ...unassigned, isNavigation: true,
      childCount: directGeographicCounts.get(unassignedId) || 0, parents: [{ id: navigationRoot }] });
    for (const entity of districts.values()) {
      if (!entity.id.startsWith('map-region:')) continue;
      nodes.push({ ...entity, adminNodeId: entity.adminNodeId || entity.adminPath?.at(-1), parents: [] });
    }
    if (!index.canonicalPlaces) for (const id of baselineIds) {
      const entity = entities.get(id);
      nodes.push({ ...entity, adminNodeId: entity.adminPath?.at(-1), parents: (entity.containedBy || []).map(id => ({ id, regionCode: entity.regionCode })) });
    }
    for (const entity of personal) nodes.push({ ...entity, adminNodeId: personalParent(entity), parents: [] });
    for (const id of Object.keys({ ...personalState.placeEdits.overrides, ...personalState.placeEdits.created })) {
      const entity = await resolveEntity(id);
      if (!entity) continue;
      const parentId = entity.parentId ?? entity.related?.find(edge => edge.kind === 'within')?.id ?? entity.adminNodeId ?? entity.adminPath?.at(-1);
      nodes.push({ ...entity, parents: parentId ? [{ id: parentId, regionCode: entity.regionCode }] : [] });
    }
    if (index.canonicalPlaces && index.runtimeSource?.kind !== 'overture') for (const row of identityOverrides) {
      if (index.packageMode && !index.activeRegionCodes?.includes(row.regionCode)) continue;
      const entity = remember({ ...row, canonicalPlace: true, adminPath: [...(admin.nodes.get(row.adminNodeId)?.adminPath || []), row.adminNodeId].filter(Boolean) });
      if (entity) nodes.push({ ...entity, parents: (row.related || []).filter(e => e.kind === 'within').map(e => ({ id: e.id, regionCode: row.regionCode })) });
    }
    return nodes;
  }
  const adminChildrenAll = () => administrativeIds.map(id => entities.get(id));
  function directoryNode(node) {
    if (!node?.id || isRetiredLivingArea(node) || isHiddenAggregateDisplayPoint(node) || isSecondaryDisplayPoint(node)) return null;
    const override = getIdentityOverride(node.id);
    return override ? { ...node, name: override.name, adminNodeId: override.adminNodeId, regionCode: override.regionCode } : node;
  }
  async function getDirectory() {
    await loadIndex();
    if (!directory) {
      let view = index;
      if (!index.canonicalPlaces?.geographicIndex) {
        const codes = new Set(index.canonicalPlaces?.catalogIndex?.parts.flatMap(p => p.regionCodes || ['00']) || index.regions?.map(r => r.code) || []);
        view = { ...index, canonicalPlaces: { ...index.canonicalPlaces, geographicIndex: { version: 1, parts: [...codes].map(code => ({ path: '@experiment/' + code, regionCodes: [code] })) } } };
      }
      directory = createGeographicDirectory({ index: view,
        read: path => path.startsWith('@experiment/') ? run('geographicNodes', path.slice(12)) : run('geographicRead', path),
        lookup: directoryLookup, supplements: directorySupplements, normalizeNode: directoryNode, rootId: navigationRoot, unassignedId });
    }
    while (directoryVersion !== supplementVersion) {
      if (!directoryRefresh) {
        const version = supplementVersion;
        directoryRefresh = directory.refreshSupplements()
          .then(() => { directoryVersion = version; })
          .finally(() => { directoryRefresh = null; });
      }
      await directoryRefresh;
    }
    return directory;
  }
  async function hydrateDirectoryNode(node) {
    if (!node) return null;
    let entity = entities.get(canonicalIds.get(node.id) || node.id) || navigation.get(node.id);
    if (node.ref && (!entity || entity.personalPlace)) entity = remember(await run('geographicResolve', node.ref));
    if (!entity) entity = remember(node);
    if (!entity) return null;
    const value = { ...entity, parents: (node.parents || []).map(ref => ({ ...ref })), hasChildren: Boolean(node.hasChildren || node.childCount), childCount: node.childCount || 0 };
    entities.set(value.id, value);
    return value;
  }
  async function browsePage(id, options = {}) {
    const graph = await getDirectory(), result = await graph.page(id, options);
    return { ...result, items: (await Promise.all(result.items.map(hydrateDirectoryNode))).filter(Boolean) };
  }
  async function browseChildren(id, options = {}) { return (await browsePage(id, options)).items; }
  const children = browseChildren;
  async function browseNode(id) { return hydrateDirectoryNode(await (await getDirectory()).node(id)); }
  async function browseParent(entity, options = {}) {
    const path = await (await getDirectory()).path(typeof entity === 'string' ? entity : browseEntryId(entity), options);
    return path.at(-2)?.id || navigationRoot;
  }
  async function browseLocation(entity, options = {}) {
    return (await getDirectory()).locate(browseEntryId(entity), options);
  }
  const adminChildren = id => (administrativeChildren.get(id) || []).map(childId => entities.get(childId));
  const navigationChildren = (id = navigationRoot, options = {}) => browseChildren(id, options);
  async function navigationPath(id, options = {}) {
    if (id === 'admin:jp' || id === navigationRoot) return [];
    const nodes = await (await getDirectory()).path(id, options);
    return (await Promise.all(nodes.map(hydrateDirectoryNode))).filter(Boolean);
  }
  async function normalizeBrowseState(state = {}) {
    await loadIndex();
    const translate = async id => {
      if (!id || id === 'admin:jp') return navigationRoot;
      if (id.startsWith('browse-category:')) {
        const part = id.slice('browse-category:'.length).split(':')[0];
        return decodeURIComponent(part);
      }
      if (id.startsWith('facility:base:')) return id.slice('facility:base:'.length);
      if (id.startsWith('facility:')) {
        if (state.regionCode) await ensureFacilities(state.regionCode);
        return facilities.get(id)?.entityId || navigationRoot;
      }
      return id;
    };
    const normalizeSnapshot = async snapshot => {
      if (!snapshot) return snapshot;
      const current = await translate(snapshot.current);
      const pathIds = (await Promise.all((snapshot.pathIds || []).map(translate))).filter(id => id !== navigationRoot);
      return { ...snapshot, current, offset: current === snapshot.current ? snapshot.offset || 0 : 0,
        selectedId: snapshot.selectedId ? await translate(snapshot.selectedId) : null, pathIds };
    };
    return { ...await normalizeSnapshot(state), expanded: [...new Set(await Promise.all((state.expanded || []).map(translate)))].filter(id => id !== navigationRoot),
      ...(state.searchHistory ? { searchHistory: { origin: await normalizeSnapshot(state.searchHistory.origin), results: await normalizeSnapshot(state.searchHistory.results) } } : {}) };
  }
  function getEntity(id) {
    if (isRetiredLivingArea(id) || isHiddenAggregateDisplayPoint(id)) return null;
    id = displayRepresentativeId(id);
    const canonical = entities.get(canonicalIds.get(id)); if (canonical) return canonical;
    if (index?.canonicalPlaces && baselineIds.has(id) && !resolvedOldIds.has(id)) return null;
    return entities.get(id) || navigation.get(id) || (id === unassignedId ? unassigned : null) || (resolvedOldIds.has(id) ? personalPlaces.get(id) : null) || null;
  }
  async function related(entity, { limit = 8, radiusMeters = 800 } = {}) {
    await loadIndex(); if (!entity?.id || isRetiredLivingArea(entity) || entity.browseOnly || entity.type === '行政区') return [];
    const source = await resolveEntity(entity.id, { regionCode: entity.regionCode || activeCode }) || entity;
    if (index.runtimeSource?.kind === 'overture') {
      const peers = new Map(), parents = (source.related || []).filter(edge => edge.kind === 'within');
      for (const ref of parents) {
        const parent = await resolveEntity(ref.id);
        for (const edge of parent?.related || []) if (edge.kind === 'contains' && edge.id !== source.id) {
          const target = await resolveEntity(edge.id);
          if (target && (!Object.hasOwn(placeEditRecord(target, personalState)?.fields || {}, 'parentId') || target.related?.some(edge => edge.kind === 'within' && edge.id === ref.id))) peers.set(target.id, { ...target, relationKind: 'same_parent' });
        }
        for (const id of Object.keys({ ...personalState.placeEdits.overrides, ...personalState.placeEdits.created })) {
          const target = await resolveEntity(id);
          if (target && target.id !== source.id && target.related?.some(edge => edge.kind === 'within' && edge.id === ref.id)) peers.set(target.id, { ...target, relationKind: 'same_parent' });
        }
      }
      if (!parents.length && source.adminNodeId) {
        for (const target of await browseChildren(source.adminNodeId, { limit: Number.MAX_SAFE_INTEGER }))
          if (target.id !== source.id && target.kind === source.kind) peers.set(target.id, { ...target, relationKind: 'same_parent' });
      }
      return [...peers.values()];
    }
    const sourceIds = new Set([source.id, source.legacyPlaceId, ...(source.allSourceIds || source.sourceIds || [])].filter(Boolean));
    // LJ-REVIEWED-RELATED-20261031: an empty reviewed selection stays empty; only ordinary places discover nearby candidates.
    const selected = regionSelections.get(displayRepresentativeId(source.id)), reviewed = selected !== undefined;
    const edges = reviewed ? selected : [...(source.related || [])];
    if (!reviewed) for (const relation of baseData.walkingInterests || []) if (sourceIds.has(relation.anchorPlaceId)) edges.push({ id: relation.targetPlaceId, kind: 'walking_interest', evidence: relation.relationId });
    if (!reviewed && !index.canonicalPlaces) {
      await ensureFacilities(source.regionCode);
      const group = facilities.ownedBy(source.id) || facilities.get(facilities.parentOf(source.id));
      if (group) for (const ref of [group.entityRef, ...group.memberRefs].filter(Boolean)) edges.push({ id: ref.id, kind: group.kind === 'station' ? 'station_area' : 'facility_member', evidence: group.evidence, regionCode: ref.regionCode || group.regionCode, path: ref.path });
    }
    const result = new Map();
    const add = (target, relationKind, evidence, priority, sourceSelectionOrder) => {
      if (!target || target.browseOnly || target.type === '行政区' || sourceIds.has(target.id) || (target.allSourceIds || []).some(id => sourceIds.has(id))) return;
      if (index.canonicalPlaces && !target.canonicalPlace) return;
      if (result.has(target.id) && result.get(target.id).priority <= priority) return;
      result.set(target.id, { ...target, relationKind, relationEvidence: evidence, distanceMeters: placeDistanceMeters(source, target), priority, ...(Number.isFinite(sourceSelectionOrder) ? { sourceSelectionOrder } : {}) });
    };
    for (const edge of edges) add(await resolveEntity(edge.id, { regionCode: edge.regionCode || source.regionCode || activeCode, ...(edge.path ? { path: edge.path } : {}) }), edge.kind || 'related', edge.evidence, 0, edge.kind === 'source-selected' ? edge.order : undefined);
    const max = Math.max(0, Math.min(100, Number(limit) || 0));
    if (!reviewed) for (const target of await run('nearby', source, { radiusMeters, limit: 64 })) add(remember(target), 'nearby', null, 1);
    return chooseRelatedPlaces([...result.values()], max).map(({ priority, ...target }) => target);
  }
  // LJ-RELATED-CONTAINERS-20261102: UI siblings use current full membership; macro relations retain their original order.
  async function relatedDisplay(entity) {
    await loadIndex();
    const overture = index.runtimeSource?.kind === 'overture' || Boolean(entity?.livingAreaRole);
    const rows = await related(entity, overture ? {} : { limit: 7 });
    const peers = overture ? rows : chooseRelatedIntroductions(rows);
    if (!peers.length || !peers.every(row => row.relationKind === 'same_parent')) return peers;
    const graph = await getDirectory();
    const ranked = await Promise.all(peers.map(async row => ({ row, hasChildren: Boolean((await graph.node(row.id))?.hasChildren) })));
    return ranked.sort((a, b) => Number(b.hasChildren) - Number(a.hasChildren)).map(item => item.row);
  }
  return { loadIndex, loadRegion, search, startTextSearch, textSearchPage: async (queryId, options) => presentSearchPage(await run('textSearchPage', queryId, options)), textSearchStats: () => run('textSearchStats'),
    startMapSearch, mapSearchPage: async (queryId, options) => presentSearchPage(await run('mapSearchPage', queryId, options)), mapSearchStats: () => run('mapSearchStats'),
    cancelSearch: scope => { searchListeners.delete(scope); return run('cancelSearch', scope, nextSearchVersion(scope)); }, children, browsePage, browseChildren, browseNode, browseParent, browseLocation, browseEntryId, normalizeBrowseState, adminChildren, navigationRoot, navigationChildren, navigationPath, district,
    availability: code => { const spec=[...(index?.views || []),...(index?.regions || [])].find(row=>row.code===String(code)); return {available:spec?.available !== false,packageId:spec?.packageId || index?.regionPackageIds?.[String(code)]}; },
    get: getEntity, related, relatedDisplay, relatedDisplayRevision: () => supplementVersion, setPersonalPlaces, personalIds: () => [...new Set([...personalPlaces.keys(), ...Object.keys(personalState.placeEdits.created)])],
    async resolveBuiltin(id) { await resolveEntity(id); return builtinEntities.get(canonicalIds.get(id) || id) || null; },
    resolve: resolveEntity, resolveLight: async id => Object.hasOwn(personalState.placeEdits.created, id) ? resolveEntity(id) : remember(await run('canonicalResolveLight', id)),
    resolveLights: async ids => (await Promise.all(ids.map(id => Object.hasOwn(personalState.placeEdits.created, id) ? resolveEntity(id) : run('canonicalResolveLight', id).then(remember)))).filter(Boolean),
    async activationCandidates(texts) {
      const candidates = await run('activationCandidates', texts), found = new Map();
      const text = (texts || []).map(value => String(value || '').normalize('NFKC').toLocaleLowerCase());
      const matches = row => (row.personalFullTriggers ?? [row.activationName || row.name, ...(row.fullNames || [])]).some(term => term && text.some(value => value.includes(String(term).normalize('NFKC').toLocaleLowerCase())));
      for (const candidate of candidates) { const projected = projectPersonal(candidate); if (!Array.isArray(projected.personalFullTriggers) || matches(projected)) found.set(projected.id, projected); }
      for (const id of Object.keys({ ...personalState.placeEdits.overrides, ...personalState.placeEdits.created })) { const row = await resolveEntity(id); if (row && matches(row)) found.set(row.id, row); }
      return [...found.values()];
    }, landOverview: () => run('landOverview'), adminBoundary: id => run('adminBoundary', id),
    regions: () => [...(index?.views || []), ...(index?.regions || [])].map(region => { const group = groupByRegion.get(region.code); return group ? { ...region, groupId: group.id, groupCode: group.code, groupName: group.name } : region; }),
    schematicEntity: (id, fallback) => presentCatalogEntity(getEntity(id) || entities.get(id) || fallback, baseData) || null,
    async viewport(code, bounds, options = {}) {
      const requestVersion = options.requestScope ? nextViewportVersion(options.requestScope) : undefined;
      const result = await run('viewport', code, bounds, { ...options, requestVersion }), points = result.entities.map(remember).filter(entity => entity && isMapPointVisible(entity, options.pointVisibility));
      for (const id of Object.keys({ ...personalState.placeEdits.overrides, ...personalState.placeEdits.created })) {
        const entity = await resolveEntity(id), point = projectCoordinates(entity?.coordinates, index.projection);
        if (point && (!bounds || point[0] >= bounds[0] && point[0] <= bounds[2] && point[1] >= bounds[1] && point[1] <= bounds[3]) && isMapPointVisible(entity, options.pointVisibility)) points.push({ ...entity, coordinates: { ...entity.coordinates, x: point[0], y: point[1] } });
      }
      return { ...result, entities: [...new Map(points.map(row => [row.id, row])).values()] };
    },
    cancelViewport: scope => run('cancelViewport', scope, nextViewportVersion(scope)),
    projection: () => index?.projection || {},
    stats: () => ({ mode: remote ? 'worker' : 'inline', entities: entities.size, regions: [...regionViews.keys()] }),
    workerStats: () => run('stats'),
    destroy() { remote?.destroy(); local?.clear(); searchListeners.clear(); loaded.clear(); regionViews.clear(); entities.clear(); personalPlaces.clear(); canonicalIds.clear(); resolvedOldIds.clear(); navigation.clear(); groupByRegion.clear(); administrativeIds.length = 0; administrativeChildren.clear(); directGeographicCounts.clear(); facilities.clear(); facilityRegions.clear(); } };
}
