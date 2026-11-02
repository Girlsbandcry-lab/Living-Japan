// LJ-MAP-DEDUP-01: display representatives only; source identities and text remain independent.
const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '');
const subtypeAliases = {
  convenience_store: 'convenience', bank_or_credit_union: 'bank', police_station: 'police',
  doctors_office: 'doctors', fast_food_restaurant: 'fast_food', japanese_restaurant: 'restaurant',
  buddhist_place_of_worship: 'place_of_worship', train_station: 'rail_station', light_rail_and_subway_station: 'rail_station',
};
const broadTypes = new Set(['地点', '未分类地点', '地理地点', '建筑']);
const subtype = entity => entity.type === '车站' || entity.kind === 'station' ? 'rail_station' : entity.subtype && entity.subtype !== 'unknown' ? subtypeAliases[entity.subtype] || entity.subtype : '';
function compatible(a, b) {
  const left = subtype(a), right = subtype(b);
  if (left && right) return left === right;
  return Boolean(a.type && a.type === b.type && !broadTypes.has(a.type));
}
function distance(a, b) {
  const left = a.coordinates, right = b.coordinates;
  if (![left?.longitude, left?.latitude, right?.longitude, right?.latitude].every(Number.isFinite)) return Infinity;
  return 111320 * Math.hypot((left.longitude - right.longitude) * Math.cos((left.latitude + right.latitude) * Math.PI / 360), left.latitude - right.latitude);
}

export function sameMapPoint(a, b) {
  if (!a || !b) return false;
  if (a.id && a.id === b.id || (a.legacyPlaceId || b.legacyPlaceId) && (a.legacyPlaceId || a.id) === (b.legacyPlaceId || b.id)) return true;
  if (a.canonicalPlace && b.canonicalPlace) return false;
  const leftSource = a.source?.namespace, rightSource = b.source?.namespace, name = normalize(a.originalName || a.name);
  if (!leftSource || !rightSource || leftSource === rightSource || !name || name !== normalize(b.originalName || b.name) || !compatible(a, b)) return false;
  const meters = distance(a, b);
  if (meters <= 2) return true;
  const address = normalize(a.address);
  return meters <= 30 && /\d/.test(address) && address === normalize(b.address);
}

export function deduplicateMapPoints(points) {
  const kept = [], identities = new Set(), names = new Map();
  for (const point of points) {
    if (!point) continue;
    const name = normalize(point.originalName || point.name);
    if (identities.has(point.id) || point.legacyPlaceId && identities.has(point.legacyPlaceId) || (names.get(name) || []).some(other => sameMapPoint(point, other))) continue;
    kept.push(point); if (point.id) identities.add(point.id); if (point.legacyPlaceId) identities.add(point.legacyPlaceId);
    if (!names.has(name)) names.set(name, []); names.get(name).push(point);
  }
  return kept;
}
