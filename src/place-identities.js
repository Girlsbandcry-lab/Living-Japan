import { getIdentityOverride, sanitizeIdentity } from './place-identity-overrides.js';
import { displayRepresentativeId, isSecondaryDisplayPoint, augmentDisplayRepresentative } from './place-display-representatives.js';
// LJ-CANONICAL-USER-IDENTITY-20261030: source identities share runtime lookup while personal records keep their original keys.
import { presentStation } from './station-presentation.js';
import { isRetiredLivingArea } from './living-area-retirement.js';
import { regionBackgroundRelations } from './region-selections.js';
const unique = values => [...new Set(values.filter(value => typeof value === 'string' && value))];
const ownIds = entity => unique([entity?.legacyPlaceId, entity?.id, ...(entity?.sourceIds || []), ...(entity?.allSourceIds || [])]);

export function canonicalPlaceContext(entity, data = {}) {
  if (isRetiredLivingArea(entity)) return null;
  const index = data.canonicalPlaceContexts;
  if (!index) return null;
  for (const id of typeof entity === 'string' ? [entity] : ownIds(entity)) {
    const target = getIdentityOverride(id)?.id || displayRepresentativeId(id);
    const row = index.rows?.[index.aliases?.[target] || target];
    if (row) return row;
  }
  return null;
}

export function placeIdentityIds(entity, data = {}) {
  const value = typeof entity === 'string' ? { id: entity } : entity;
  const canonical = canonicalPlaceContext(value, data);
  return canonical ? unique([...ownIds(canonical).slice(0, canonical.legacyPlaceId ? 2 : 1), ...ownIds(value), ...ownIds(canonical)]) : ownIds(value);
}

export function placeStorageId(entity, data = {}) {
  const canonical = canonicalPlaceContext(entity, data);
  return canonical?.legacyPlaceId || canonical?.id || entity.legacyPlaceId || entity.id;
}

export function personalPlaceRecord(entity, data = {}, field) {
  for (const id of placeIdentityIds(entity, data)) {
    const row = data.materialLibrary?.places?.[id];
    if (row && (field === undefined || Object.hasOwn(row, field))) return row;
  }
  return null;
}

export function placeParentContexts(entity, data = {}) {
  if (!entity) return [];
  const source = canonicalPlaceContext(entity, data) || entity, result = new Map();
  for (const edge of source.related || []) {
    if (edge.kind !== 'within') continue;
    const parent = canonicalPlaceContext(edge.id, data);
    if (parent && parent.id !== source.id) result.set(parent.id, { ...parent, relationKind: 'within' });
  }
  const nodes = new Map([...(data.adminNodes || []), ...Object.values(data.canonicalPlaceContexts?.adminNodes || {}), ...(source.adminNodes || [])].map(node => [node.id, node]));
  for (const id of source.adminPath || []) {
    const node = nodes.get(typeof id === 'string' ? id : id.id);
    if (!node || node.id === 'admin:jp' || node.id === source.id) continue;
    result.set(node.id, { ...node, name: node.name || node.label || node.nameJa, type: '行政区', relationKind: 'administrative_parent' });
  }
  return [...result.values()];
}

export function placeDistrictContexts(entity, data = {}) {
  if (!entity) return [];
  const regions = new Map((data.mapRegions || []).map(row => [displayRepresentativeId(row.id), row]));
  const relations = regionBackgroundRelations(data.mapRegions), own = new Set(placeIdentityIds(entity, data).map(displayRepresentativeId)), result = new Map();
  for (const id of own) for (const districtId of relations.get(id) || []) {
    if (own.has(districtId) || result.has(districtId)) continue;
    const region = regions.get(districtId);
    result.set(districtId, { ...region, ...canonicalPlaceContext(districtId, data), name: region.name, relationKind: 'district_context' });
  }
  return [...result.values()];
}

export function placeBindingGroups(entity, data = {}) {
  const ids = new Set(placeIdentityIds(entity, data));
  const bindings = Object.values(data.materialLibrary?.bindings || {}).filter(binding => ids.has(binding.entityId));
  if (!canonicalPlaceContext(entity, data) && !entity.canonicalPlace) return bindings.map(binding => ({ ...binding, bindingIds: [binding.id] }));
  const groups = new Map();
  for (const binding of bindings) {
    if (!groups.has(binding.categoryId)) groups.set(binding.categoryId, { ...binding, enabled: true, bindingIds: [] });
    const group = groups.get(binding.categoryId);
    group.bindingIds.push(binding.id);
    if (binding.enabled === false) group.enabled = false;
  }
  return [...groups.values()];
}

export async function createCanonicalContextPreparer({ data, catalog, index, baseUrl, fetcher = globalThis.fetch }) {
  if (!index.canonicalPlaces) return undefined;
  const overture = index.runtimeSource?.kind === 'overture';
  const contexts = { aliases: {}, rows: {}, adminNodes: Object.fromEntries((index.adminNodes || []).map(node => [node.id, node])) }, resolved = new Set(), expanded = new Set(), baselineIds = new Set();
  let revision = 0;
  const register = source => {
    if (!source?.id || isRetiredLivingArea(source) || isSecondaryDisplayPoint(source)) return null;
    source = sanitizeIdentity(augmentDisplayRepresentative(source));
    source = presentStation(source, data);
    if (!contexts.rows[source.id] || contexts.rows[source.id].canonicalIndexOnly && !source.canonicalIndexOnly) {
      const keys = ['id', 'name', 'originalName', 'activationName', 'displayType', 'legacyPlaceId', 'aliases', 'fullNames', 'chainBrand', 'chainBrandAliases', 'chainNameSource', 'chainSearchOnlyNames', 'packageIds', 'type', 'subtype', 'kind', 'regionCode', 'adminNodeId', 'adminPath', 'adminNodes', 'coordinates', 'summary', 'hasSummary', 'officialRail', 'livingAreaRole', 'displayAnchorCoordinates', 'livingAreaBounds', 'livingAreaAnchorSource', 'materialTypeId'];
      const row = Object.fromEntries(keys.filter(key => source[key] !== undefined).map(key => [key, source[key]]));
      row.sourceIds = ownIds(source); row.canonicalPlace = true;
      if (source.canonicalIndexOnly) row.canonicalIndexOnly = true;
      row.related = (source.related || []).filter(edge => !isRetiredLivingArea(edge)).map(edge => ({ id: edge.id, ...(edge.kind ? { kind: edge.kind } : {}), ...(edge.membershipKind ? { membershipKind: edge.membershipKind } : {}), ...(edge.evidence !== undefined ? { evidence: edge.evidence } : {}), ...(Number.isFinite(edge.order) ? { order: edge.order } : {}), ...(Number.isFinite(edge.distanceMeters) ? { distanceMeters: edge.distanceMeters } : {}) }));
      contexts.rows[row.id] = row; revision++;
    }
    const row = contexts.rows[source.id];
    for (const id of ownIds(source)) if (contexts.aliases[id] !== row.id) { contexts.aliases[id] = row.id; revision++; }
    return row;
  };
  if (index.runtimeSource?.kind !== 'overture' && (data.runtimeTextManifest?.contextsPath || index.canonicalPlaces.baselineContextPath)) {
    const response = await fetcher(new URL(data.runtimeTextManifest?.contextsPath || 'data/national/' + index.canonicalPlaces.baselineContextPath, baseUrl));
    if (!response.ok) throw new Error('地点身份对照读取失败：' + response.status);
    const payload = await response.json();
    for (const row of Array.isArray(payload.rows) ? payload.rows : Object.values(payload.rows || {})) {
      register(row);
      // LJ-BASELINE-CONTEXT-ANCHORS-20261030: nearby snapshots expand when users later register them.
      if (row.packageIds?.length) baselineIds.add(row.id);
    }
    for (const [id, target] of Object.entries(payload.aliases || {})) if (!isRetiredLivingArea(id) && !isSecondaryDisplayPoint(id) && !getIdentityOverride(id) && contexts.rows[target]) {
      contexts.aliases[id] = target;
      contexts.rows[target].sourceIds = unique([...contexts.rows[target].sourceIds, id]);
    }
  }
  if (index.runtimeSource?.kind !== 'overture') for (const row of data.mapRegions || []) register(row);
  data.canonicalPlaceContexts = contexts;
  async function resolve(id) {
    if (isRetiredLivingArea(id)) return null;
    id = getIdentityOverride(id)?.id || displayRepresentativeId(id);
    const known = contexts.rows[contexts.aliases[id] || id];
    if (known && !known.canonicalIndexOnly) return known;
    if (resolved.has(id)) return null;
    const entity = await catalog.resolve(id);
    resolved.add(id);
    return entity?.canonicalPlace ? register(entity) : null;
  }
  async function resolveList(id) {
    const known = contexts.rows[contexts.aliases[id] || id];
    if (known) return known;
    const entity = catalog.resolveLight ? await catalog.resolveLight(id) : await catalog.resolve(id);
    return entity?.canonicalPlace ? register(entity) : null;
  }
  // LJ-LIVING-REQUEST-20261101: exact request identities prepare their direct graph without spatial or count limits.
  async function expandGraph(ids, includePeerAreas = false) {
    const chain = new Set(), queue = [...ids], large = new Set();
    while (queue.length) {
      const row = await resolve(queue.shift());
      if (!row || chain.has(row.id)) continue;
      chain.add(row.id);
      if (row.livingAreaRole === 'large') large.add(row.id);
      const listIds = [];
      for (const edge of row.related || []) {
        if (edge.kind === 'within') queue.push(edge.id);
        else if (edge.kind === 'contains' && !contexts.rows[contexts.aliases[edge.id] || edge.id]) listIds.push(edge.id);
      }
      if (listIds.length && catalog.resolveLights) (await catalog.resolveLights(listIds)).forEach(register);
      else for (const id of listIds) await resolveList(id);
    }
    if (includePeerAreas) for (const id of large) {
      const area = contexts.rows[id];
      if ((area.related || []).some(edge => edge.kind === 'within') || !area.adminNodeId) continue;
      for (const peer of await catalog.browseChildren(area.adminNodeId, { limit: Number.MAX_SAFE_INTEGER }))
        if (peer.kind === 'life_area' && peer.livingAreaRole === 'large') register(peer);
    }
  }
  const prepare = async container => {
    catalog.setPersonalPlaces?.(container);
    const before = revision, library = container.materialLibrary || {};
    const ids = unique([...Object.values(container.customSlots || {}).map(slot => slot.entityId), ...Object.keys(library.places || {}), ...Object.values(library.bindings || {}).map(binding => binding.entityId)]);
    if (overture) { await expandGraph(ids); return revision !== before; }
    for (const id of ids) {
      const row = await resolve(id);
      if (!row || expanded.has(row.id)) continue;
      if (baselineIds.has(row.id)) {
        for (const edge of row.related) await resolve(edge.id);
      } else {
        const parents = row.related.filter(edge => edge.kind === 'within');
        for (const edge of parents) await resolve(edge.id);
        const targets = await catalog.related(row, { limit: 8, radiusMeters: 800 });
        row.related = [...parents, ...targets.filter(target => !parents.some(edge => edge.id === target.id)).map(target => {
          register(target);
          return { id: target.id, kind: target.relationKind || 'related', ...(target.relationEvidence !== undefined ? { evidence: target.relationEvidence } : {}), ...(Number.isFinite(target.sourceSelectionOrder) ? { order: target.sourceSelectionOrder } : {}), ...(Number.isFinite(target.distanceMeters) ? { distanceMeters: target.distanceMeters } : {}) };
        })];
        revision++;
      }
      expanded.add(row.id);
    }
    return revision !== before;
  };
  if (overture) prepare.prepareRequest = async (messages, settings, { engine, requestType = 'normal' } = {}) => {
    const before = revision;
    if (settings.masterEnabled === false || settings.layers?.EX === false) return { directPlaceIds: [], changed: false,
      placeMatchDiagnostics: { directPlaceIds: [], matches: [], stopReason: settings.masterEnabled === false ? 'master_disabled' : 'ex_disabled' } };
    const entries = engine.collectChannelEntries(messages, 'EX', settings.historyDepth, requestType, settings);
    const candidates = await catalog.activationCandidates(entries.map(entry => entry.text));
    let storyState = null;
    if (candidates.some(row => row.dateConditionalTriggers?.length)) {
      const timeEntries = engine.collectChannelEntries(messages, 'TN', settings.historyDepth, requestType, settings)
        .map(entry => ({ ...entry, text: engine.maskTrafficDurationForTimeChannel(entry.text) }));
      storyState = engine.resolveTimeStateDetailed(timeEntries).state;
    }
    // LJ-PLACE-MATCH-REQUEST-20261101: one resolved subject and its evidence feed both preview and generation.
    const placeMatchDiagnostics = engine.resolveCanonicalPlaceMatchDetailed
      ? engine.resolveCanonicalPlaceMatchDetailed(entries, candidates, storyState)
      : { directPlaceIds: engine.resolveCanonicalPlaceMatches(entries, candidates), matches: [] };
    const directPlaceIds = unique(placeMatchDiagnostics.directPlaceIds);
    await expandGraph(directPlaceIds, settings.expandPeerLivingAreas === true);
    return { directPlaceIds, placeMatchDiagnostics, changed: revision !== before };
  };
  return prepare;
}
