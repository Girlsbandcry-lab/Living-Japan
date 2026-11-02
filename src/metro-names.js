import { withoutChainBrands } from './chain-place-names.js';

let metroNames = {};
export function installMetroNames(value = {}) { metroNames = value; }
export function currentMetroNames() { return metroNames; }

// LJ-METRO-NAME-PRESENTATION-20261031: formal Chinese names are additive to original identity and activation evidence.
const regions = new Set(['11', '12', '13', '14']);
const unique = values => [...new Set(values.filter(value => typeof value === 'string' && value.trim()))];
export function applyMetroName(entity, names = metroNames) {
  if (!entity || entity.personalPlace || !regions.has(entity.regionCode)) return entity;
  const entry = names[entity.id] || (entity.sourceIds || []).map(id => names[id]).find(Boolean);
  if (!entry?.nameZh) return entity;
  if (entity.chainBrand && !withoutChainBrands(entity, [entry.nameZh]).length) return { ...entity, aliases: unique([...(entity.aliases || []), entry.nameZh, entry.originalName, ...(entry.aliases || [])]).filter(name => name !== entity.name) };
  return { ...entity, name: entry.nameZh, originalName: entity.originalName || entry.originalName || entity.name,
    activationName: entity.activationName || entity.name,
    aliases: unique([entity.name, entity.originalName, ...(entity.aliases || []), ...(entity.originalNames || []),
      ...(entity.fullNames || []), ...(entity.searchAliases || []), entity.activationName, entry.originalName, ...(entry.aliases || [])])
      .filter(name => name !== entry.nameZh),
    fullNames: unique([...(entity.fullNames || []), entity.activationName || entity.name, entry.nameZh]),
  };
}

export function metroEntityTitle(entity, title) {
  if (!entity || entity.personalPlace || !regions.has(entity.regionCode)) return title;
  const identityNames = [entity.name, entity.originalName, ...(entity.aliases || []), ...(entity.fullNames || [])];
  return identityNames.includes(title) ? entity.name : title;
}
