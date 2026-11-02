import { createPackResourceFetcher } from './region-pack-resources.js';
import { installMetroNames } from './metro-names.js';
import { createRegionService } from './catalog.js';
let service;
self.onmessage = async ({ data }) => {
  const { id, method, args = [] } = data;
  try {
    if (method === 'init') { const config=args[0]; installMetroNames(config.metroNames); if(config.packSnapshot) config.fetcher=createPackResourceFetcher({snapshot:config.packSnapshot,baseUrl:config.baseUrl}); service = createRegionService({ ...config, onSearchUpdate: update => self.postMessage({ event: 'map-search-update', update }) }); self.postMessage({ id, result: true }); return; }
    if (!service || typeof service[method] !== 'function') throw new Error('全国资料尚未准备好');
    self.postMessage({ id, result: await service[method](...args) });
  } catch (error) { self.postMessage({ id, error: error.message }); }
};
