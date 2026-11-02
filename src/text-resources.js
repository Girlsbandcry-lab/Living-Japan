import { placeDistrictContexts, placeIdentityIds } from './place-identities.js';

export function addBuiltinContextAnchors(data) {
  let order = Math.max(0, ...data.packages.map(item => item.order || 0)) + 1;
  for (const anchor of data.runtimeContextAnchors || []) {
    const ids = new Set(placeIdentityIds({ id: anchor.placeId }, data));
    if (data.packages.some(item => !item.materialFragmentId && ids.has(item.placeId))) continue;
    data.packages.push({ ...anchor, order: order++, body: '', allowEmptyBody: true, materialAnchor: true, contextAnchor: true,
      layer: 'EX', uiGroupId: null, matchMode: 'direct', activation: null, aliasTriggers: [], conditionalTriggers: [], blockedTerms: [], links: [], triggerLinks: [],
      placeKind: 'content_object', sourceObjectId: 'context:' + anchor.placeId, defaultEnabled: true });
    data.defaultSettings.packages[anchor.id] = true;
  }
  return data;
}

// LJ-LAZY-TEXTS-20261031: browse structure, selected introductions, selected details, then complete generation text.
export function createTextResources({ data, baseUrl, fetcher = globalThis.fetch }) {
  const manifest = data.runtimeTextManifest, loadedBodies = new Set(), loadedSummaries = new Set(), pending = new Map();
  let allReady = !manifest?.allBodiesPath;
  async function read(path) {
    if (!pending.has(path)) pending.set(path, (async () => {
      const response = await fetcher(new URL(path, baseUrl));
      if (!response.ok) throw new Error('Living Japan 文字资源读取失败：' + response.status);
      return response.json();
    })().catch(error => { pending.delete(path); throw error; }));
    return pending.get(path);
  }
  function apply(patches) {
    for (const patch of patches || []) {
      let owner = data;
      for (const key of patch.path.slice(0, -1)) owner = owner[key] ||= {};
      owner[patch.path.at(-1)] = patch.value;
    }
  }
  function applyBody(payload) {
    if (loadedBodies.has(payload.packageId)) return false;
    apply(payload.patches); loadedBodies.add(payload.packageId); return true;
  }
  function applySummary(payload) {
    if (loadedSummaries.has(payload.id)) return false;
    apply(payload.patches);
    for (const row of payload.contexts || []) {
      const contexts = data.canonicalPlaceContexts, target = contexts?.rows?.[contexts.aliases?.[row.id] || row.id];
      if (target) target.summary = row.summary;
    }
    loadedSummaries.add(payload.id); return true;
  }
  async function ensureBodies(ids = []) {
    let changed = false;
    for (const id of new Set(ids)) if (manifest.bodies[id] && !loadedBodies.has(id)) changed = applyBody(await read(manifest.bodies[id])) || changed;
    return changed;
  }
  async function ensureSummaries(ids = []) {
    let changed = false;
    const expanded = new Set(ids.flatMap(id => {
      const entity = typeof id === 'object' ? id : { id };
      return [entity, ...placeDistrictContexts(entity, data)].flatMap(row => placeIdentityIds(row, data));
    }));
    for (const id of expanded) if (manifest.summaries[id] && !loadedSummaries.has(id)) changed = applySummary(await read(manifest.summaries[id])) || changed;
    return changed;
  }
  async function ensureAllBodies() {
    if (allReady) return false;
    const [bodies, summaries] = await Promise.all([read(manifest.allBodiesPath), read(manifest.allSummariesPath)]);
    let changed = false;
    for (const payload of bodies.packages) changed = applyBody(payload) || changed;
    for (const payload of summaries.entities) changed = applySummary(payload) || changed;
    allReady = true; return changed;
  }
  return { ensureBodies, ensureSummaries, ensureAllBodies, isGenerationReady: () => allReady };
}
