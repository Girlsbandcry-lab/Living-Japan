// LJ-LIVING-AREA-MAP-20261101: navigation anchors stay separate from visible place coordinates.
export const isLivingArea = entity => ['large', 'small'].includes(entity?.livingAreaRole);
export const navigationCoordinates = entity => entity?.coordinates || (isLivingArea(entity) ? entity.displayAnchorCoordinates : null) || null;

export function livingAreaMapVisible(entity, viewport) {
  if (entity?.livingAreaRole === 'small') return false;
  if (entity?.livingAreaRole !== 'large') return true;
  const area = entity.livingAreaBounds;
  if (!Array.isArray(area) || area.length !== 4 || !area.every(Number.isFinite) || !viewport?.every(Number.isFinite)) return false;
  const areaSize = Math.max(0, area[2] - area[0]) * Math.max(0, area[3] - area[1]);
  const viewSize = (viewport[2] - viewport[0]) * (viewport[3] - viewport[1]);
  // Use the full area, not the clipped intersection: extreme close-ups must disappear too.
  const proportion = viewSize > 0 ? areaSize / viewSize : 0;
  return proportion >= 0.015 && proportion <= 1.5;
}
