import { canonicalPlaceContext, placeIdentityIds } from './place-identities.js';
import { placeDetailPackageIds } from './place-metadata.js';
import { chainPlaceIdentity } from './chain-place-names.js';
import { isRailStation, presentStation } from './station-presentation.js';

// LJ-INJECTION-NAME-Q09: UI activation text shares identity-aware names without registering new macro triggers.
const unique = values => [...new Set(values.filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))];
const key = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/gu, '');

export function injectionName(entity, data = {}) {
  if (typeof entity === 'string') return entity;
  if (!entity) return '';
  const canonical = canonicalPlaceContext(entity, data), identity = { ...canonical, ...entity };
  if (isRailStation(identity)) return presentStation(identity, data).name;
  const chain = chainPlaceIdentity(entity, data);
  if (chain?.name) return chain.name;

  const ids = new Set(placeIdentityIds(entity, data));
  const packageIds = new Set([...(entity.packageIds || []), ...(canonical?.packageIds || []), ...placeDetailPackageIds(entity, data)]);
  const packages = (data.packages || []).filter(item => !item.materialFragmentId && (ids.has(item.placeId) || packageIds.has(item.id)));
  const activation = unique([entity.activationName, canonical?.activationName]);
  const fullNames = unique([...(entity.fullNames || []), ...(canonical?.fullNames || [])]);
  const registered = unique(packages.flatMap(item => item.fullTriggers || []));
  const full = unique([...activation, ...fullNames, ...registered]);
  const preferred = unique([...activation, ...packages.map(item => item.displayName)]).filter(value => full.some(name => key(name) === key(value)));
  const short = new Set(unique([entity.shortName, canonical?.shortName]).filter(value => preferred.some(name => key(name) !== key(value) && key(name).includes(key(value)))).map(key));
  const complete = full.filter(value => !short.has(key(value)));
  const isFull = value => value && complete.some(name => key(name) === key(value));
  const preservesFull = value => value && !short.has(key(value)) && complete.some(name => key(value).includes(key(name)));
  const selected = unique([
    preservesFull(entity.name) && entity.name,
    ...activation.filter(isFull),
    preservesFull(canonical?.name) && canonical.name,
    ...packages.map(item => item.displayName).filter(isFull),
    ...fullNames.filter(isFull), ...registered.filter(isFull),
  ])[0];
  if (selected) return selected;

  const fallback = unique([entity.originalName, canonical?.originalName, canonical?.name, entity.name, entity.label])[0] || '';
  for (const item of packages) {
    const combination = item.locationComposite;
    if (!combination?.cores?.some(core => key(core) === key(fallback))) continue;
    const qualifier = unique(combination.qualifiers || [])[0];
    if (qualifier) return qualifier + ' ' + fallback;
  }
  return fallback;
}

export function injectionEndpoints(endpoints, selection, data = {}) {
  return Object.fromEntries(Object.entries(endpoints).map(([key, value]) => {
    if (!['origin', 'destination'].includes(key) || !value) return [key, value];
    return [key, { ...value, label: injectionName(selection[key], data) || value.label }];
  }));
}
