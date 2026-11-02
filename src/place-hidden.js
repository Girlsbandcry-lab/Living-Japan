import { canonicalPlaceContext, placeIdentityIds } from './place-identities.js';

// LJ-PLACE-HIDDEN-20261102: personal visibility suppresses only the marked entity, while recognition and relations stay intact.
export function normalizeHiddenPlaceIds(value) {
  return Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string' && id.trim()))] : [];
}

export function hiddenPlaceId(entity, data = {}) {
  const value = typeof entity === 'string' ? { id: entity } : entity;
  return canonicalPlaceContext(value, data)?.id || value?.id || '';
}

export function isHiddenPlace(entity, ids, data = {}) {
  const hidden = ids instanceof Set ? ids : new Set(normalizeHiddenPlaceIds(ids));
  const id = hiddenPlaceId(entity, data);
  return hidden.has(id) || placeIdentityIds(entity, data).some(value => hidden.has(value)) ||
    [...hidden].some(value => canonicalPlaceContext(value, data)?.id === id);
}
