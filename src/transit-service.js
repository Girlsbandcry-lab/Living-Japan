import transit from './legacy/transit-time.js';
import transitMap from './legacy/transit-map.js';
import { canonicalPlaceContext } from './place-identities.js';
import { navigationCoordinates } from './living-area-map.js';

// LJ-METRO-TRANSIT-20261031: current place identities and access legs share the preserved reference estimator.
const REGIONS = { '11': 'saitama', '12': 'chiba', '13': 'tokyo', '14': 'kanagawa' };
const administrative = entity => !entity || ['country', 'prefecture', 'city', 'ward', 'town', 'village', 'administrative', 'region'].includes(entity.kind) || entity.id?.startsWith('admin:') || entity.source?.namespace === 'administration';
const coordinate = value => Array.isArray(value) ? { longitude: value[0], latitude: value[1] } : value;
const validCoordinate = value => value && Number.isFinite(value.longitude) && Number.isFinite(value.latitude);
const identifiers = entity => [...new Set([entity.id, entity.legacyPlaceId, ...(entity.sourceIds || []), ...(entity.allSourceIds || [])].filter(Boolean))];
const mergeUnique = (original, additions, key) => {
  const known = new Set(original.map(item => item[key]));
  return [...original, ...additions.filter(item => !known.has(item[key]))];
};

export function createTransitService({ fields, baseData = {}, supplement = {} }) {
  const original = fields.transitTime;
  const data = {
    ...original,
    stationAnchors: mergeUnique(original.stationAnchors || [], supplement.stations || [], 'stationId'),
    railNetwork: {
      ...original.railNetwork,
      lines: mergeUnique(original.railNetwork.lines || [], supplement.lines || [], 'lineId'),
      edges: mergeUnique(original.railNetwork.edges || [], supplement.edges || [], 'edgeId'),
      transferLinks: original.railNetwork.transferLinks || [],
    },
  };
  const estimator = transit.createEstimator(data);
  const stations = new Map(), byAlias = new Map();
  for (const station of data.stationAnchors) {
    stations.set(station.stationId, station);
    for (const id of [station.stationId, station.railStationId, station.mapStationId, ...(station.aliases || [])].filter(Boolean)) byAlias.set(id, station.stationId);
  }
  const usable = new Set([...data.railNetwork.edges, ...data.railNetwork.transferLinks].flatMap(edge => [edge.fromStationId, edge.toStationId]));
  const placeById = new Map((baseData.places || []).map(place => [place.placeId, place]));
  const crosswalk = new Map((baseData.stationAdministration?.contentStationCrosswalk || []).map(row => [row.placeId, row.railStationId]));
  const maxKm = original.model?.rail?.maximumNearestStationKm || 8;

  function resolvePhysicalEndpoint(entity) {
    if (administrative(entity)) return null;
    if (entity.transitResolved) return entity;
    const ids = identifiers(entity), place = ids.map(id => placeById.get(id)).find(Boolean);
    const regionId = REGIONS[String(entity.regionCode)] || place?.regionId || entity.regionId || '';
    const point = coordinate(navigationCoordinates(entity) || place?.coordinates);
    const candidates = [];
    const add = id => { const canonical = byAlias.get(id); if (canonical && !candidates.includes(canonical)) candidates.push(canonical); };
    for (const code of entity.officialRail?.sourceGroupCodes || []) add(`n02_station_${code}`);
    for (const id of ids) {
      add(crosswalk.get(id));
      if (id.startsWith('place:rail_station:')) add(id.slice('place:rail_station:'.length));
      if (id.startsWith('rail:mlit-station-')) add(`n02_station_${id.slice('rail:mlit-station-'.length)}`);
      if (byAlias.has(id) && (entity.type === 'station' || entity.type === '车站' || entity.kind === 'station')) add(id);
    }
    for (const id of [place?.railStationId, place?.mapStationId, place?.stationId]) add(id);
    const isStation = Boolean(entity.officialRail || entity.type === '车站' || entity.type === 'station' || place?.kind === 'station' || entity.kind === 'station');
    if (isStation && candidates.length) {
      const station = stations.get(candidates[0]);
      return { transitResolved: true, type: 'station', id: station.stationId, sourceId: entity.id, label: entity.name || entity.label || station.label, stationIds: candidates,
        regionId: station.regionId || regionId, coordinates: validCoordinate(point) ? point : { longitude: station.longitude, latitude: station.latitude } };
    }
    if (!validCoordinate(point)) return null;
    const inScope = Object.values(REGIONS).includes(regionId);
    const nearby = inScope && !isStation ? data.stationAnchors.filter(station => usable.has(station.stationId))
      .map(station => ({ id: station.stationId, km: transit.haversineKm(point, station) }))
      .filter(item => item.km <= maxKm).sort((a, b) => a.km - b.km || a.id.localeCompare(b.id)).slice(0, 3) : [];
    return { transitResolved: true, type: place?.sourceObjectId ? 'object' : place?.kind === 'editorial_area' ? 'area' : 'place',
      id: place?.sourceObjectId || entity.id, sourceId: entity.id, label: entity.name || entity.label || place?.label || entity.id,
      regionId, coordinates: point, stationIds: nearby.map(item => item.id),
      accessReference: nearby.length ? { basis: 'straight_distance_times_1_25_at_4_kmh', maximumKm: maxKm, candidates: nearby } : null };
  }

  // LJ-DISTRICT-TRANSIT-20261031: explicit real anchors supply routes while selected districts keep their identity and full name.
  function resolveEndpoint(entity) {
    if (administrative(entity) || entity.transitResolved) return resolvePhysicalEndpoint(entity);
    const ids = identifiers(entity), district = (baseData.mapRegions || []).find(row => ids.includes(row.id));
    if (!district?.displayAnchorPlaceId) return resolvePhysicalEndpoint(entity);
    const endpoint = resolvePhysicalEndpoint(canonicalPlaceContext(district.displayAnchorPlaceId, baseData));
    return endpoint ? { ...endpoint, sourceId: entity.id, label: entity.name || entity.label || district.name } : null;
  }

  function estimateAll({ origin: originEntity, destination: destinationEntity }) {
    const origin = resolveEndpoint(originEntity), destination = resolveEndpoint(destinationEntity);
    const result = estimator.estimateAll({ origin, destination });
    // A displayed station may retain several official station groups; compare their existing routes without treating nearby unrelated stations as members.
    const options = endpoint => endpoint?.type === 'station' ? endpoint.stationIds.map(id => ({ ...endpoint, id, stationIds: [id] })) : [endpoint];
    for (const start of options(origin)) for (const end of options(destination)) {
      if (start === origin && end === destination) continue;
      const value = estimator.estimateRoute({ origin: start, destination: end, mode: 'public_transit' });
      const prior = result.estimates.public_transit;
      if (value.ok && (!prior.ok || value.minutes < prior.minutes || value.minutes === prior.minutes && value.railPath.transferCount < prior.railPath.transferCount)) result.estimates.public_transit = value;
    }
    const rail = result.estimates.public_transit;
    if (rail.ok && (origin?.accessReference || destination?.accessReference)) rail.accessReference = {
      basis: 'straight_distance_times_1_25_at_4_kmh', origin: origin?.accessReference || null, destination: destination?.accessReference || null,
      description: '接驳为直线距离加绕行系数的步行参考，不是已核步行路线',
    };
    return { origin, destination, estimates: result.estimates, coverage: { regionCodes: Object.keys(REGIONS), ...(supplement.coverage || {}) } };
  }
  return { resolveEndpoint, estimateAll, format: transitMap._test.buildTrafficComment,
    coverage: { regionCodes: Object.keys(REGIONS), ...(supplement.coverage || {}) } };
}

export async function loadTransitService({ baseline, baseData, baseUrl = new URL('../', import.meta.url), fetcher = globalThis.fetch.bind(globalThis) }) {
  const [legacy, response] = await Promise.all([baseline.transitTime.load(), fetcher(new URL('data/metro-transit.json', baseUrl))]);
  if (!response.ok) throw new Error(`首都圈铁路连接资料读取失败 (${response.status})`);
  const supplement = await response.json();
  return createTransitService({ fields: legacy.data, baseData, supplement });
}
