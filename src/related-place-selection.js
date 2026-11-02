// LJ-RELATED-CHOICE-20261030: direct relations lead; local candidates favor useful whole places and a small mix of types.
const distance = row => Number.isFinite(row.distanceMeters) ? row.distanceMeters : Infinity;
const explicit = row => row.relationKind !== 'nearby';
const described = row => Boolean(row.hasSummary || String(row.summary || '').trim());
const detailed = row => Boolean(row.packageIds?.length || row.bodyStatus === 'builtin');
const publicTypes = /公园|庭园|博物馆|美术馆|图书馆|剧场|剧院|电影院|神社|寺院|景点|文化|体育|商场|百货|市场|大学|车站/;
const publicSubtypes = new Set(['park', 'garden', 'museum', 'gallery', 'library', 'theatre', 'cinema', 'shrine', 'temple', 'attraction', 'viewpoint', 'arts_centre', 'community_centre', 'stadium', 'sports_centre', 'mall', 'department_store', 'marketplace', 'university', 'train_station', 'light_rail_and_subway_station']);
const routineSubtypes = new Set(['convenience', 'parking', 'atm', 'vending_machine', 'fast_food']);
const quality = row => publicTypes.test(row.type || '') || publicSubtypes.has(row.subtype) ? 0 : routineSubtypes.has(row.subtype) || /便利店|停车|自贩机/.test(row.type || '') ? 2 : 1;
const sourceOrder = (a, b) => a.relationKind === 'source-selected' && b.relationKind === 'source-selected' ? (a.sourceSelectionOrder ?? Infinity) - (b.sourceSelectionOrder ?? Infinity) : 0;
const identityOrder = (a, b) => String(a.id).localeCompare(String(b.id));

export function chooseRelatedPlaces(rows, limit = 8) {
  const sorted = [...rows].sort((a, b) => Number(explicit(b)) - Number(explicit(a)) || sourceOrder(a, b) ||
    (explicit(a) ? 0 : Number(described(b) || detailed(b)) - Number(described(a) || detailed(a)) || quality(a) - quality(b)) ||
    distance(a) - distance(b) || identityOrder(a, b));
  const chosen = [], types = new Map();
  for (const row of sorted) {
    if (chosen.length >= limit) break;
    const type = row.subtype || row.type || '地点';
    if (!explicit(row)) {
      if ((types.get(type) || 0) >= 2) continue;
      types.set(type, (types.get(type) || 0) + 1);
    }
    chosen.push(row);
  }
  return chosen;
}

export function chooseRelatedIntroductions(rows) {
  const sorted = [...rows].sort((a, b) => Number(explicit(b)) - Number(explicit(a)) || sourceOrder(a, b) || Number(described(b)) - Number(described(a)) || distance(a) - distance(b) || identityOrder(a, b));
  const chosen = []; let nearby = 0;
  for (const row of sorted) {
    if (chosen.length === 7) break;
    if (!explicit(row) && nearby++ >= 3) continue;
    chosen.push(row);
  }
  return chosen;
}
