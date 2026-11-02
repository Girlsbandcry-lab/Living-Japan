import { METRO_POINT_CATEGORIES, METRO_POINT_GROUPS } from './metro-point-categories.js';
import { MAP_POINT_CATEGORIES, MAP_POINT_GROUPS, mapPointCategoryIds } from './map-point-categories.js';
import { isFavoritePlace, normalizeFavoritePlaceIds } from './place-favorites.js';
import { isHiddenPlace, normalizeHiddenPlaceIds } from './place-hidden.js';

// LJ-PEER-QUOTAS-20261102: one concrete category owns each peer quota; category ancestors never inherit it.
export const DEFAULT_PEER_PLACE_QUOTA = 5;
export const PEER_PLACE_CATEGORIES = [
  ...METRO_POINT_CATEGORIES,
  ...MAP_POINT_CATEGORIES.map(row => ({ ...row, layer: 'legacy' })),
];
export const PEER_PLACE_GROUPS = [
  ...METRO_POINT_GROUPS,
  ...MAP_POINT_GROUPS.map(row => ({ ...row, layer: 'legacy' })),
];

export function normalizePeerPlaceQuotas(value) {
  return Object.fromEntries(Object.entries(value && typeof value === 'object' && !Array.isArray(value) ? value : {})
    .filter(([id, quota]) => id && typeof quota === 'number' && Number.isSafeInteger(quota) && quota >= 0));
}

const categoryIds = new Set(PEER_PLACE_CATEGORIES.map(row => row.id));
export function peerPlaceCategoryId(row) {
  const specific = row?.typePathIds?.findLast(id => categoryIds.has(id));
  if (specific) return specific;
  if (categoryIds.has(row?.materialTypeId)) return row.materialTypeId;
  if (row?.kind === 'station' || row?.officialRail) return 'in.transport.station';
  return mapPointCategoryIds(row)[0] || 'other';
}

function draw(rows, limit, random) {
  if (rows.length <= limit) return rows;
  const shuffled = [...rows];
  for (let i = 0; i < limit; i++) {
    const at = i + Math.floor(random() * (shuffled.length - i));
    [shuffled[i], shuffled[at]] = [shuffled[at], shuffled[i]];
  }
  const selected = new Set(shuffled.slice(0, limit).map(row => row.id));
  return rows.filter(row => selected.has(row.id));
}

export function selectPeerPlaces(rows, { quotas, favoritePlaceIds, hiddenPlaceIds, data = {}, cache = {}, random = Math.random } = {}) {
  const amounts = normalizePeerPlaceQuotas(quotas), favorites = new Set(normalizeFavoritePlaceIds(favoritePlaceIds));
  const hidden = new Set(normalizeHiddenPlaceIds(hiddenPlaceIds));
  const categories = new Map();
  for (const row of rows) {
    if (isHiddenPlace(row, hidden, data)) continue;
    const categoryId = peerPlaceCategoryId(row);
    if (!categories.has(categoryId)) categories.set(categoryId, []);
    categories.get(categoryId).push(row);
  }
  const groups = [...categories].map(([categoryId, candidates]) => ({
    categoryId, quota: amounts[categoryId] ?? DEFAULT_PEER_PLACE_QUOTA,
    candidateIds: candidates.map(row => row.id),
    favoriteIds: candidates.filter(row => isFavoritePlace(row, favorites, data)).map(row => row.id),
  }));
  const key = JSON.stringify(groups);
  let chosen = cache[key];
  if (!chosen) {
    chosen = groups.map(group => {
      const candidates = categories.get(group.categoryId), marks = new Set(group.favoriteIds);
      const preferred = draw(candidates.filter(row => marks.has(row.id)), group.quota, random);
      const ordinary = draw(candidates.filter(row => !marks.has(row.id)), group.quota - preferred.length, random);
      return [...preferred, ...ordinary].map(row => row.id);
    });
    cache[key] = chosen;
  }
  const byId = new Map(rows.map(row => [row.id, row]));
  return { rows: chosen.flat().map(id => byId.get(id)), groups: groups.map((group, index) => ({ ...group, selectedIds: [...chosen[index]] })) };
}
