// LJ-MAP-LEVELS-20261031: object roles and zoom bands are shared by all three layouts.
export function mapLevelPolicy(mode, scale) {
  const near = scale > 1 / 0.62, street = scale > 1 / 0.3;
  return { mode, near, street, regionAnchor: scale > (1 / 0.3) * Math.exp(1), close: scale > 1 / 0.03,
    regions: true, featured: mode === 'schem' || mode !== 'map' && near,
    stations: mode === 'schem' || mode !== 'map' && near,
    ordinary: mode === 'ultra' && street,
    regionCircles: mode !== 'ultra' };
}

export const mapPointRole = entity => entity?.mapRole || (entity?.kind === 'map-region' ? 'region' :
  entity?.kind === 'station' || entity?.type === '车站' || ['train_station', 'light_rail_and_subway_station'].includes(entity?.subtype) ? 'station' : 'ordinary');

export const mapRolePriority = entity => ({ region: 0, featured: 1, station: 2, ordinary: 3 })[mapPointRole(entity)] ?? 3;

export function presentationForRegion(data, code, included = []) {
  const codes = new Set(included.length ? included : [String(code)]);
  const inRegion = entity => code === '00' || codes.has(entity.regionCode);
  const regions = (data.regions || []).filter(inRegion), anchorIds = new Set(regions.map(row => row.displayAnchorPlaceId).filter(Boolean));
  return { ...data, regions, featured: (data.featured || []).filter(inRegion), anchorPlaces: (data.anchorPlaces || []).filter(row => anchorIds.has(row.id)) };
}
