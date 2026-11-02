import { displayRepresentativeId } from './place-display-representatives.js';

// LJ-REGION-SELECTIONS-20261031: reviewed regional selections share identities and order, never inferred containment.
export function regionSelectionRelations(regions = [], featured = []) {
  const selected = new Map(featured.map(row => [displayRepresentativeId(row.id), new Map()]));
  for (const region of regions) {
    const regionId = displayRepresentativeId(region.id);
    const members = [...new Set((region.selectedPlaceIds || []).map(displayRepresentativeId))].filter(id => id && id !== regionId);
    for (const owner of new Set([regionId, ...members, ...(region.displayAnchorPlaceId ? [displayRepresentativeId(region.displayAnchorPlaceId)] : [])])) {
      if (!selected.has(owner)) selected.set(owner, new Map());
      const targets = selected.get(owner);
      for (const id of members) if (id !== owner && !targets.has(id)) targets.set(id, { id, kind: 'source-selected', order: targets.size });
    }
  }
  return new Map([...selected].map(([id, targets]) => [id, [...targets.values()]]));
}

export function applyRegionSelection(entity, selections) {
  if (!entity) return entity;
  const curated = selections.get(displayRepresentativeId(entity.id));
  if (!curated) return entity;
  const parents = (entity.related || []).filter(edge => edge.kind === 'within');
  return { ...entity, related: [...curated, ...parents] };
}

// LJ-DISTRICT-BACKGROUND-20261031: explicit reviewed members and display anchors share district introductions, never containment.
export function regionBackgroundRelations(regions = []) {
  const backgrounds = new Map();
  for (const region of regions) {
    const regionId = displayRepresentativeId(region.id);
    for (const id of new Set([...(region.selectedPlaceIds || []), region.displayAnchorPlaceId].filter(Boolean).map(displayRepresentativeId))) {
      if (!id || id === regionId) continue;
      if (!backgrounds.has(id)) backgrounds.set(id, []);
      if (!backgrounds.get(id).includes(regionId)) backgrounds.get(id).push(regionId);
    }
  }
  return backgrounds;
}
