import textScript from './legacy/text-script.js';
import { chainPlaceIdentity } from './chain-place-names.js';

// LJ-STATION-PRESENTATION-20261030: official rail names outrank legacy evidence; search aliases and complete activation names stay separate.
const unique = values => [...new Set(values.filter(value => typeof value === 'string' && value.trim()))];
const identityIds = entity => unique([entity.legacyPlaceId, entity.id, ...(entity.sourceIds || []), ...(entity.allSourceIds || [])]);
const bus = entity => ['bus_station', 'bus_stop'].includes(entity?.subtype) || entity?.categoryCode === 'bus' || entity?.type === '公交站';
export const isRailStation = entity => !bus(entity) && (entity?.type === '车站' || entity?.kind === 'station' || ['train_station', 'light_rail_and_subway_station', 'rail_station'].includes(entity?.subtype));
const isComplete = name => /(?:駅|站|驛|驿|\s+station)$/iu.test(String(name || '').trim());
const completeName = name => isComplete(name) ? String(name).trim() : String(name || '').trim() + '站';
const displayName = name => String(name || '').trim().replace(/(?:駅|站|驛|驿|\s+station)$/iu, '') + '站';

export function buildStationNameRules(data = {}) {
  const entries = {}, identities = {}, stationByLegacy = new Map(), placeToRail = new Map();
  const ensure = key => entries[key] ||= { name: '', originalName: '', fullNames: [], searchAliases: [] };
  for (const station of data.stationAdministration?.stations || []) {
    const key = station.railStationId, entry = ensure(key); entry.originalName = station.nameJa || '';
    entry.searchAliases = data.placeNameAliases?.stations?.[key] || [];
    for (const id of [key, `place:rail_station:${key}`, ...unique([station.n02GroupCode, ...(station.sourceStationCodes || [])]).map(code => `rail:mlit-station-${code}`)]) identities[id] = key;
    for (const id of station.legacyStationIds || []) stationByLegacy.set(id, key);
  }
  for (const row of data.stationAdministration?.contentStationCrosswalk || []) placeToRail.set(row.placeId, row.railStationId);
  for (const place of data.places || []) {
    if (place.kind !== 'station') continue;
    const key = placeToRail.get(place.placeId) || place.railStationId || stationByLegacy.get(place.stationId || place.mapStationId) || identities[place.placeId] || place.placeId;
    identities[place.placeId] = key;
    const entry = ensure(key), translation = data.placePresentation?.translations?.[place.placeId];
    entry.name ||= data.placeMetadata?.names?.[place.placeId] || data.placeMetadata?.entities?.[place.placeId]?.displayName ||
      (['official_alias', 'existing_common_name', 'existing_full_name'].includes(translation?.translationKind) ? translation.zh : '');
    entry.originalName ||= place.nameJa || place.label || '';
    entry.searchAliases = unique([...entry.searchAliases, ...(place.aliases || [])]);
  }
  for (const item of data.packages || []) {
    if (item.placeKind !== 'station') continue;
    const key = identities[item.placeId] || item.placeId; if (!key) continue;
    identities[item.placeId] = key;
    const entry = ensure(key);
    entry.fullNames = unique([...entry.fullNames, ...(item.fullTriggers || [])]);
    entry.name ||= data.placeMetadata?.names?.[item.placeId] || (item.fullTriggers?.includes(item.displayName) ? item.displayName : '');
  }
  const names = { ...data.placeMetadata?.names };
  for (const [id, entry] of Object.entries(data.placeMetadata?.entities || {})) if (entry.displayName) names[id] = entry.displayName;
  return { entries, identities, names, t2s: data.textConversion?.t2s || {} };
}

function physicalSource(ref) {
  const tags = ref.tags || {};
  if (ref.stationIdentityMatch || ['stop_area', 'stop_area_group'].includes(tags.public_transport) || ['route', 'route_master', 'stop_area', 'stop_area_group'].includes(tags.type)) return false;
  return ['station', 'halt', 'tram_stop'].includes(tags.railway) || tags.public_transport === 'station';
}

export function createStationPresenter(rules = {}) {
  const converter = textScript.createConverter({ t2s: rules.t2s || {}, protectedNames: [] });
  return entity => {
    if (!entity) return entity;
    if (bus(entity)) return { ...entity, displayType: '公交站' };
    if (!isRailStation(entity)) return entity;
    const official = entity.officialRail;
    const entries = unique(identityIds(entity).map(id => rules.identities?.[id])).map(key => rules.entries[key]);
    const physical = (entity.sourceRefs || []).filter(physicalSource);
    const originalName = official?.nameJa || physical.map(ref => ref.tags?.['name:ja'] || ref.tags?.name || ref.name).find(Boolean) ||
      entries.find(entry => entry.originalName)?.originalName || entity.originalName || entity.name;
    const provedName = identityIds(entity).map(id => rules.names?.[id]).find(Boolean) || entries.find(entry => entry.name)?.name || physical.map(ref => ref.tags?.['name:zh-Hans']).find(Boolean) || physical.map(ref => ref.tags?.['name:zh']).find(Boolean);
    const name = displayName(official ? official.displayName || originalName : provedName ? converter.convert(provedName, 'simplified') : originalName);
    const knownFullNames = unique(entries.flatMap(entry => entry.fullNames || []));
    // LJ-STATION-APPEND-NAME-20261030: append the displayed complete name; older complete names remain compatible on the same identity.
    const previousName = knownFullNames.find(isComplete) || (isComplete(entity.activationName) ? entity.activationName : '') || entity.fullNames?.find(isComplete) || completeName(originalName);
    const activationName = name;
    return { ...entity, name, originalName: official ? originalName : entity.originalName || originalName, displayType: '铁路车站', activationName,
      fullNames: unique([...(entity.fullNames || []), ...knownFullNames, previousName, activationName]),
      searchAliases: unique([...(entity.searchAliases || []), ...(official ? [entity.name, entity.originalName] : []), ...entries.flatMap(entry => entry.searchAliases || []), originalName, name, previousName, activationName, ...(entity.fullNames || []), ...knownFullNames]),
    };
  };
}

const presenters = new WeakMap();
export function presentStation(entity, data = {}) {
  if (!presenters.has(data)) presenters.set(data, createStationPresenter(buildStationNameRules(data)));
  return presenters.get(data)(entity);
}

export function placeActivationName(entity, data = {}) {
  if (!isRailStation(entity)) return chainPlaceIdentity(entity, data)?.name || entity?.name || '';
  return presentStation(entity, data).name;
}
