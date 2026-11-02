// LJ-PLACE-METADATA-01: reviewed identity mappings share source summaries, one name and complete triggers.
import { placeIdentityIds, personalPlaceRecord } from './place-identities.js';
import { presentStation, isRailStation } from './station-presentation.js';
import { presentMetroPurpose } from './metro-purpose-presentation.js';
import { applyMetroName } from './metro-names.js';
import { chainPlaceTriggers, withoutChainBrands } from './chain-place-names.js';
const unique = values => [...new Set(values.filter(Boolean))];

export function applyPlaceMetadata(data, metadata) {
  const names = { ...metadata.names }, packageNames = { ...metadata.packageNames }, groupNames = {};
  const places = new Map(data.places.map(place => [place.placeId, place]));
  for (const [id, translation] of Object.entries(data.placePresentation?.translations || {})) {
    if (['existing_common_name', 'existing_full_name'].includes(translation.translationKind)) names[id] = translation.zh;
  }
  for (const [id, entry] of Object.entries(metadata.entities || {})) if (entry.displayName) names[id] = entry.displayName;
  for (const [id, entry] of Object.entries(metadata.detailLinks || {})) if (entry.displayName) names[id] = entry.displayName;
  for (const item of data.packages) {
    if (item.placeKind === 'station' && item.fullTriggers?.includes(item.displayName)) names[item.placeId] ||= item.displayName;
    if (names[item.placeId] && item.displayName === places.get(item.placeId)?.label) packageNames[item.id] ||= names[item.placeId];
  }
  for (const place of data.places) if (names[place.placeId]) for (const id of place.controlGroupIds || []) {
    const group = data.controlGroups.find(value => value.controlGroupId === id);
    if (group?.label === place.label) groupNames[id] = names[place.placeId];
  }
  const additions = new Map();
  for (const item of metadata.fullTriggerAdditions || []) for (const id of item.packageIds) {
    const target = data.packages.find(value => value.id === id && value.placeId === item.placeId);
    if (target) additions.set(id, unique([...(additions.get(id) || []), item.name]));
  }
  return {
    ...data, placeMetadata: { ...metadata, names, packageNames, groupNames },
    packages: data.packages.map(item => {
      const triggers = additions.get(item.id);
      return triggers ? { ...item, fullTriggers: unique([...(item.fullTriggers || []), ...triggers]) } : item;
    }),
  };
}

export const packageDisplayName = (item, data) => data.placeMetadata?.packageNames?.[item?.id] || item?.displayName;

// LJ-EXPLICIT-DETAIL-LINKS-20261031: only reviewed package IDs attach; source and canonical identities stay separate.
export function placeDetailPackageIds(entity, data = {}) {
  const packages = new Set((data.packages || []).map(item => item.id));
  return unique(placeIdentityIds(entity, data).flatMap(id => data.placeMetadata?.detailLinks?.[id]?.packageIds || [])).filter(id => packages.has(id));
}

// LJ-PLACE-INTRODUCTION-20261030: independent introductions never fall back to named-place detail bodies.
export function placeIntroduction(entity, data = {}) {
  if (!entity) return '';
  const ids = placeIdentityIds(entity, data), saved = personalPlaceRecord(entity, data, 'summary');
  if (saved) return typeof saved.summary === 'string' ? saved.summary : '';
  for (const id of ids) {
    const summary = data.placeMetadata?.entities?.[id]?.summary;
    if (typeof summary === 'string') return summary;
  }
  return typeof entity.summary === 'string' ? entity.summary : '';
}

function presentCatalogEntityMetadata(entity, data) {
  if (!entity) return entity;
  entity = presentMetroPurpose(presentStation(entity, data));
  const metadata = data.placeMetadata;
  if (!metadata) return entity;
  // LJ-SOURCE-INTRODUCTIONS-20261031: explicit source identities share presentation; body packages remain separate.
  const ids = placeIdentityIds(entity, data), entries = ids.flatMap(id => [metadata.entities?.[id], metadata.detailLinks?.[id]]).filter(Boolean);
  const entry = entries.find(row => typeof row.summary === 'string');
  const name = isRailStation(entity) ? entity.name : withoutChainBrands(entity, ids.map(id => metadata.names?.[id] || metadata.entities?.[id]?.displayName || metadata.detailLinks?.[id]?.displayName))[0] || entity.name;
  if (!entries.length && name === entity.name) return entity;
  const originalName = entity.originalName || entity.name;
  const linkedPackages = placeDetailPackageIds(entity, data);
  return { ...entity, name, originalName, aliases: unique([...(entity.aliases || []), originalName, ...entries.flatMap(row => row.aliases || [])]),
    fullNames: unique([...(entity.fullNames || []), ...entries.flatMap(row => row.fullNames || [])]),
    ...(entry ? { summary: entry.summary } : {}),
    ...(entries.some(row => row.hasSummary || typeof row.summary === 'string' && row.summary.trim()) ? { hasSummary: true } : {}),
    ...(linkedPackages.length ? { packageIds: unique([...(entity.packageIds || []), ...linkedPackages]),
      ...(data.packages.some(item => linkedPackages.includes(item.id) && (item.hasBody || String(item.body || '').trim())) ? { bodyStatus: 'builtin' } : {}),
    } : {}),
  };
}

export const presentCatalogEntity = (entity, data) => applyMetroName(presentCatalogEntityMetadata(entity, data));

export function placeIdentityInfo(entity, item, data) {
  const ids = new Set(placeIdentityIds(entity, data));
  const entries = [...ids].flatMap(id => [data.placeMetadata?.entities?.[id], data.placeMetadata?.detailLinks?.[id]]).filter(Boolean);
  const place = (data.places || []).find(value => ids.has(value.placeId));
  const stationId = place?.railStationId || data.stationAdministration?.stations?.find(value => value.legacyStationIds?.includes(place?.stationId || place?.mapStationId))?.railStationId;
  const metropolitan = ['11', '12', '13', '14'].includes(entity.regionCode);
  const originalName = metropolitan ? entity.originalName || entity.originalNames?.[0] || item?.displayName || entity.name : item?.displayName || entity.originalName || entity.name;
  const aliases = unique([...(entity.aliases || []), ...(place?.aliases || []),
    ...((data.placeNameAliases?.objects || {})[place?.sourceObjectId] || []),
    ...((data.placeNameAliases?.stations || {})[stationId] || []),
    ...(item?.aliasTriggers || []), ...entries.flatMap(row => row.aliases || []),
    ...(metropolitan ? [...(entity.originalNames || []), originalName, ...(entity.fullNames || []), ...(entity.searchAliases || []), entity.activationName, item?.displayName, ...(item?.fullTriggers || [])] : []),
  ]).filter(name => name !== (metropolitan ? entity.name : originalName));
  const linkedPackages = new Set([...(entity.packageIds || []), ...placeDetailPackageIds(entity, data)]);
  const packages = item ? [item] : (data.packages || []).filter(value => ids.has(value.placeId) || linkedPackages.has(value.id));
  const source = entries.find(row => row.sourceName);
  const fullTriggers = chainPlaceTriggers(entity, unique([...packages.flatMap(value => value.fullTriggers || []), ...(metropolitan ? [entity.activationName, ...(entity.fullNames || [])] : [])]));
  return { originalName, aliases: metropolitan ? unique([...aliases, ...fullTriggers]).filter(name => name !== entity.name) : aliases, sourceName: source?.sourceName || '', fullTriggers };
}
