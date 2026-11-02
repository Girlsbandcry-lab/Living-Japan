import { identities as regionIdentities, splitRules as regionSplitRules } from './reviewed-region-identities.js';
import { reviewedLandmarkCorrections } from './reviewed-landmark-corrections.js';
import { applyMetroPurposeOverride } from './metro-purpose-presentation.js';
// LJ-MUSEUM-STATION-IDENTITY-20261031: restore the protected official station separately from its namesake museum.
const museumId = 'place:content_object:D147-P072';
const station = {
  "id": "rail:mlit-station-002881",
  "name": "鉄道博物馆站",
  "originalName": "鉄道博物館",
  "type": "车站",
  "subtype": "train_station",
  "categoryCode": "交",
  "officialRail": {
    "id": "mlit-station-002881",
    "nameJa": "鉄道博物館",
    "displayName": "鉄道博物馆站",
    "sourceGroupCodes": [
      "002881"
    ],
    "sourceStationCodes": [
      "002881"
    ],
    "sourceNames": [
      "鉄道博物館"
    ],
    "operators": [
      "埼玉新都市交通"
    ],
    "lines": [
      "伊奈線"
    ],
    "sourceUrl": "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2025.html",
    "sourceDate": "2025-12-31",
    "coordinateMethod": "official-main-group-longest-line-midpoint",
    "representativeStationCode": "002881",
    "geometryBounds": [
      139.6177,
      35.91995,
      139.61795,
      35.92058
    ]
  },
  "coordinates": {
    "longitude": 139.617825,
    "latitude": 35.920265,
    "x": 202.28566,
    "y": -394.05948,
    "method": "official-main-group-longest-line-midpoint"
  },
  "source": {
    "namespace": "MLIT-N02-25",
    "group": "002881"
  },
  "packageIds": [],
  "tags": {},
  "aliases": [
    "Tetsudo Hakubutsukan",
    "Tetsudō Hakubutsukan",
    "Tetsudō-Hakubutsukan",
    "てつどうはくぶつかん",
    "大成",
    "鉄道博物館",
    "鐡道博物館",
    "铁道博物馆",
    "철도박물관"
  ],
  "sourceIds": [
    "map:japan-v3:2196214",
    "map:japan-v3:3479469",
    "osm:node:361021706",
    "osm:relation:10064359",
    "rail:mlit-station-002881"
  ],
  "related": [],
  "regionCode": "11",
  "adminNodeId": "saitama_omiya",
  "bodyStatus": "empty",
  "typePathIds": [
    "transport",
    "cat.交",
    "cat.交.rail_station"
  ],
  "overrideIdentity": true
};
export const identityOverrides = [station, ...regionIdentities, ...reviewedLandmarkCorrections].map(applyMetroPurposeOverride);
const stationIds = new Set([station.id, ...station.sourceIds]);
const stationOnlyNames = new Set(['大成', '鉄道博物馆站', '铁道博物馆站', '鉄道博物館站', '鉄道博物館駅', '鐡道博物館駅']);
const byIdentity = new Map(identityOverrides.flatMap(row => [row.id, ...(row.sourceIds || [])].map(id => [id, row])));
const splitRules = [{ ownerIds: [museumId], sourceIds: [...stationIds], removeNames: [...stationOnlyNames], keepNames: [] }, ...regionSplitRules];
export function getIdentityOverride(id) {
  return byIdentity.get(id) || null;
}
export function sanitizeIdentity(row) {
  if (!row) return row;
  const rules = splitRules.filter(rule => rule.ownerIds.includes(row.id) || rule.ownerIds.includes(row.legacyPlaceId));
  if (!rules.length) return row;
  const sourceIds = new Set(rules.flatMap(rule => rule.sourceIds));
  const removedNames = new Set(rules.flatMap(rule => rule.removeNames));
  const keptNames = new Set([row.name, row.originalName, row.officialRail?.nameJa, ...(row.officialRail?.sourceNames || []), ...rules.flatMap(rule => rule.keepNames)].filter(Boolean));
  const result = { ...row };
  for (const key of ['sourceIds', 'allSourceIds']) if (row[key]) result[key] = row[key].filter(id => !sourceIds.has(id));
  for (const key of ['aliases', 'originalNames', 'searchAliases', 'fullNames']) if (row[key]) result[key] = row[key].filter(name => !removedNames.has(name) || keptNames.has(name));
  if (row.writingStationMembers) result.writingStationMembers = row.writingStationMembers.filter(member => !sourceIds.has(member.id));
  return result;
}
