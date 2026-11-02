import { canonicalPlaceContext, placeIdentityIds } from './place-identities.js';

// LJ-PLACE-FAVORITES-20261102: direct personal marks are shared by browsing and expansion, separate from shortcut slots.
export function normalizeFavoritePlaceIds(value) {
  return Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string' && id.trim()))] : [];
}

export function favoritePlaceId(entity, data = {}) {
  const value = typeof entity === 'string' ? { id: entity } : entity;
  return canonicalPlaceContext(value, data)?.id || value?.id || '';
}

export function isFavoritePlace(entity, ids, data = {}) {
  const favorites = ids instanceof Set ? ids : new Set(normalizeFavoritePlaceIds(ids));
  return favorites.has(favoritePlaceId(entity, data)) || placeIdentityIds(entity, data).some(id => favorites.has(id));
}
