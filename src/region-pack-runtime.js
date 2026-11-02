// LJ-REGION-RUNTIME-20261102: active packages own the complete Overture indexes; framework data never fills missing places.
const clone = value => structuredClone(value);
const unique = (rows, key = 'path') => [...new Map(rows.map(row => [row[key], row])).values()];
const sections = { catalogIndex: ['parts'], spatialIndex: ['parts', 'stationParts'], geographicIndex: ['parts'], activationIndex: ['parts'], livingAreaIndex: ['parts'] };
function mergeCounts(sources) {
  const result = {};
  for (const source of sources) for (const [key, value] of Object.entries(source.counts || {})) {
    result[key] = typeof value === 'number' ? (result[key] || 0) + value : Array.isArray(value) ? [...new Set([...(result[key] || []), ...value])] : clone(value);
  }
  return result;
}
function mergeIndex(sources, arrays, defaults = {}) {
  const result = clone(defaults);
  for (const source of sources) for (const [key, value] of Object.entries(source)) if (!arrays.includes(key) && !['counts', 'adminParts'].includes(key)) result[key] = clone(value);
  for (const key of arrays) result[key] = clone(unique(sources.flatMap(source => source[key] || [])));
  if (!sources.length || sources.some(source => source.counts)) result.counts = mergeCounts(sources);
  return result;
}
export function composeRegionIndex(core, snapshot = {}) {
  const index = clone(core.nationalManifest), fragments = (snapshot.manifests || []).map(item => item.nationalManifestFragment || {});
  const frameworkCanonical = index.canonicalPlaces || {}, frameworkSource = index.runtimeSource || frameworkCanonical.runtimeSource;
  // These paths belong to installed packages, including when a caller supplies an older framework.
  for (const key of ['landOverviewPath', 'metroRoadsPath', 'mapPresentationPath', 'schematicMetroPath', 'poiParts', 'pbfParts', 'facilityParts', 'storesPath', 'legacyPointAssets', 'storesSha256', 'counts', 'runtimeSource']) delete index[key];
  index.packageMode = true;
  index.activeRegionCodes = [...new Set((snapshot.manifests || []).flatMap(item => item.regionCodes || []))];
  index.regionPackageIds = core.regionPackageIds;
  const regions = new Map(fragments.flatMap(item => item.regions || []).map(row => [row.code, row]));
  index.regions = (core.availableRegions || []).map(row => ({ ...row, ...regions.get(row.code), packageId: core.regionPackageIds[row.code], available: regions.has(row.code) }));
  for (const row of regions.values()) if (!index.regions.some(item => item.code === row.code)) index.regions.push({...row, available:true});
  index.views = unique(fragments.flatMap(item => item.views || []), 'code').map(row=>({...row,available:true}));
  if (!index.views.some(row=>row.code==='metro')) index.views.unshift({code:'metro',name:'首都圈',regionCodes:['11','12','13','14'],packageId:'metro',available:false});
  for (const fragment of fragments) for (const [key,value] of Object.entries(fragment)) if (!['regions','views','canonicalPlaces'].includes(key)) index[key]=clone(value);
  const sources = fragments.map(item => item.canonicalPlaces).filter(source => source &&
    (source.parts?.length || source.aliasParts?.length || Object.entries(sections).some(([key, arrays]) => arrays.some(array => source[key]?.[array]?.length))));
  const canonical = index.canonicalPlaces = mergeIndex(sources, ['parts', 'aliasParts']);
  if (canonical.schemaVersion === undefined && frameworkCanonical.schemaVersion !== undefined) canonical.schemaVersion = frameworkCanonical.schemaVersion;
  const categories = sources.flatMap(source => source.categories || []);
  canonical.categories = clone(categories.length ? unique(categories, 'id') : frameworkCanonical.categories || []);
  for (const [key, arrays] of Object.entries(sections)) canonical[key] = mergeIndex(sources.map(source => source[key]).filter(Boolean), arrays, key === 'geographicIndex' ? { version: 1 } : {});
  const runtimeSources = fragments.map(item => item.runtimeSource || item.canonicalPlaces?.runtimeSource).filter(Boolean);
  if (runtimeSources.length || frameworkSource) {
    const metadata = runtimeSources.length ? Object.assign({}, ...runtimeSources) : frameworkSource;
    index.runtimeSource = { ...clone(metadata), districtCodes: [...new Set(runtimeSources.flatMap(source => source.districtCodes || []))] };
    canonical.runtimeSource = clone(index.runtimeSource);
  }
  return index;
}
export function createRuntimeFetcher({baseUrl,index,emptyRuntime,resourceFetcher,hasRuntime=false}) {
  const root=new URL('./',baseUrl);
  return async (input,options) => {
    const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,root);
    const path=url.href.startsWith(root.href)?url.pathname.slice(root.pathname.length):'';
    if(path==='data/national/manifest.json') return Response.json(index);
    if(path==='data/runtime/runtime.json'&&!hasRuntime) return Response.json(emptyRuntime);
    return resourceFetcher(input,options);
  };
}
export function preserveUnavailableSettings(previous={},normalized={},activePackageIds) {
  const packages={...previous.packages,...normalized.packages};
  if(activePackageIds) { const active=new Set(activePackageIds); for(const [id,value] of Object.entries(previous.packages || {})) if(!active.has(id)) packages[id]=value; }
  return {...previous,...normalized,groups:{...previous.groups,...normalized.groups},packages};
}
