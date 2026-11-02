// LJ-CHAIN-PLACE-NAMES-20261031: complete branch names activate one place; brands and proved shared names stay searchable.
const unique = values => [...new Set(values.filter(value => typeof value === 'string' && value.trim()))];
const key = value => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, '');

export function chainPlaceIdentity(entity, data = {}) {
  const contexts = data.canonicalPlaceContexts;
  for (const id of [entity?.id, entity?.legacyPlaceId, ...(entity?.sourceIds || []), ...(entity?.allSourceIds || [])]) {
    const row = contexts?.rows?.[contexts.aliases?.[id] || id];
    if (row?.chainBrand) return row;
  }
  return entity?.chainBrand ? entity : null;
}

export function withoutChainBrands(entity, names = []) {
  const values = unique(names);
  if (!entity?.chainBrand) return values;
  const brands = new Set([entity.chainBrand, ...(entity.chainBrandAliases || []), ...(entity.chainSearchOnlyNames || [])].map(key));
  return values.filter(name => !brands.has(key(name)));
}

export function chainPlaceTriggers(entity, names = []) {
  return withoutChainBrands(entity, entity?.chainBrand ? [entity.name, ...(entity.fullNames || []), ...names] : names);
}
