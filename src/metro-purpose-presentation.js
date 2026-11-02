import { metroPurposeNames, metroPurposeOverridePaths } from './metro-purpose-catalog.js';

// LJ-METRO-PURPOSE-PRESENTATION-20261031: show verified use while retaining source type evidence.
const metro = new Set(['11', '12', '13', '14']);
const specificNames = { aquarium: '水族馆', zoo: '动物园', public_bath: '公共浴场', sauna: '桑拿', nightclub: '夜店' };
export function metroPurposeType(entity) {
  if (!metro.has(entity?.regionCode) || entity.type === '车站' || entity.kind === 'station' || entity.officialRail) return null;
  if (!['layer:IN', 'layer:EX'].includes(entity.typePathIds?.[0])) return null;
  const name = entity.typePathIds.map(id => metroPurposeNames[id]).filter(Boolean).at(-1);
  return name ? specificNames[entity.subtype] || name : null;
}

export function presentMetroPurpose(entity) {
  const displayType = metroPurposeType(entity);
  return displayType ? { ...entity, displayType } : entity;
}

export function applyMetroPurposeOverride(row) {
  const typePathIds = metroPurposeOverridePaths[row.id];
  return typePathIds ? { ...row, typePathIds } : row;
}
