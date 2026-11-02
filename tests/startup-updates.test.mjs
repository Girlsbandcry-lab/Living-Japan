import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { entryDOM } from './helpers/entry-dom.mjs';

if (!process.execArgv.includes('--experimental-test-module-mocks')) {
  test('startup update lifecycle integration', () => {
    const env = {...process.env}; delete env.NODE_TEST_CONTEXT;
    const run = spawnSync(process.execPath, ['--experimental-test-module-mocks', '--test', fileURLToPath(import.meta.url)], { encoding: 'utf8', env });
    assert.equal(run.status, 0, run.stdout + run.stderr);
  });
} else {
  test('startup checks once; opening, settings state reads and workspace rebuild reuse the same update state; manual checks still run', async () => {
    const env = entryDOM(), originalFetch = globalThis.fetch, originalDocument = globalThis.document;
    const calls = [], mounted = [], handles = [];
    let resolveCatalog, resolveRebuilt, leaveChecks=0;
    const catalogReady = new Promise(resolve => { resolveCatalog = resolve; });
    const rebuilt = new Promise(resolve => { resolveRebuilt = resolve; });
    const manifest = {schemaVersion:1,id:'metro',version:'1',dependencies:[],chunks:[],files:{}};
    let registry = {schemaVersion:1,setupComplete:true,chunks:{},packages:{metro:{enabled:true,installed:{version:'1',manifestUrl:'https://packs.test/metro.json',manifest}},other:{enabled:false,installed:{version:'1',manifestUrl:'https://packs.test/other.json',manifest:{...manifest,id:'other'}}}}};
    const store = {read:()=>({extensionUi:{}}),subscribe:()=>()=>{},load:async()=>{}};
    const patch = (path, exports) => handles.push(mock.module(new URL(path, import.meta.url).href, { namedExports: exports }));
    patch('../src/storage.js',{createUserStore:()=>store,createSillyTavernTransport:()=>({})});
    patch('../src/floating-entry.js',{createFloatingEntry:()=>({setError(){},destroy(){}})});
    patch('../src/host-entries.js',{registerHostEntries:()=>()=>{}});
    patch('../src/region-pack-runtime.js',{composeRegionIndex:()=>({}),createRuntimeFetcher:()=>globalThis.fetch});
    patch('../src/app.js',{startLivingJapan:async options=>{
      let opened=false;
      const app={...options,open:async()=>{opened=true;},close:async()=>{opened=false;},canLeave:async()=>{leaveChecks++;return true;},isOpen:()=>opened,destroy(){}};
      mounted.push(app); if(mounted.length===2)resolveRebuilt(); return app;
    }});
    globalThis.document=env.document;
    globalThis.fetch=async(input,options={})=>{
      const url=String(input);calls.push({url,method:options.method||'GET',body:options.body});
      if(url.endsWith('region-pack-source.json'))return Response.json({catalogUrl:'https://packs.test/catalog.json'});
      if(url.endsWith('region-framework.json'))return Response.json({version:'v20261102'});
      if(url.endsWith('empty-runtime.json'))return Response.json({});
      if(url==='/user/files/living-japan-region-packs.json')return Response.json(registry);
      if(url==='/api/files/upload'){const body=JSON.parse(options.body);registry=JSON.parse(Buffer.from(body.data,'base64'));return Response.json({path:'user/files/'+body.name});}
      if(url==='https://packs.test/catalog.json'){await catalogReady;return Response.json({schemaVersion:1,packages:[{id:'metro',name:'首都圈',version:'1',manifestUrl:'metro.json',dependencies:[],chunks:[]}]});}
      if(url==='/api/extensions/discover')return Response.json([{name:'third-party/Living-Japan',type:'local'}]);
      if(url==='/api/extensions/version')return Response.json({currentCommitHash:'abc',remoteUrl:'https://example.test/Living-Japan',isUpToDate:false});
      throw new Error('Unexpected request '+url);
    };
    try {
      const {startLivingJapan}=await import('../src/bootstrap.js');
      const app=await startLivingJapan({baseUrl:'https://app.test/Living-Japan/',context:{getRequestHeaders:()=>({})}});
      const count=url=>calls.filter(call=>call.url===url).length;
      await new Promise(resolve=>setImmediate(resolve));
      assert.equal(count('/api/extensions/version'),1);assert.equal(count('https://packs.test/catalog.json'),1);
      const program=mounted[0].updates;assert.equal(program.getState().available,true);assert.equal(program.getState().version,'v20261102');
      const opening=app.openPackages();await new Promise(resolve=>setImmediate(resolve));
      assert.equal(count('https://packs.test/catalog.json'),1,'first package opening must await the startup request');
      resolveCatalog();await opening;
      await app.open();await app.close();await app.open();await app.openPackages();
      program.getState();app.packManager.getUpdateSummary();
      assert.equal(count('/api/extensions/version'),1);assert.equal(count('https://packs.test/catalog.json'),1);
      assert.equal(leaveChecks,0,'opening packages must not ask to discard drafts');
      env.document.getElementById('living-japan-region-pack-panel').querySelector('[data-pack-action="enable:other"]').fire('click');
      let timeout;try{await Promise.race([rebuilt,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('workspace rebuild did not complete')),2000);})]);}finally{clearTimeout(timeout);}
      assert.equal(mounted.length,2);assert.equal(mounted[1].updates,program);
      assert.equal(leaveChecks,1,'activation still uses the workspace leave gate');
      assert.equal(count('/api/extensions/version'),1);assert.equal(count('/api/extensions/discover'),1);
      await program.check();await app.packManager.refreshCatalog();
      assert.equal(count('/api/extensions/version'),2);assert.equal(count('https://packs.test/catalog.json'),2);
      assert.ok(calls.filter(call=>call.url==='/api/extensions/version').every(call=>JSON.parse(call.body).extensionName==='Living-Japan'));
      await app.close();registry.packages.metro.enabled=false;await app.packManager.load();await app.open();
      assert.equal(mounted.at(-1).isOpen(),false,'old disabled metro must return to required setup');
      assert.equal(env.document.getElementById('living-japan-region-pack-panel').querySelector('[data-pack-action="enable:metro"]').hidden,false);
      delete registry.packages.metro;await app.packManager.load();await app.open();
      assert.equal(mounted.at(-1).isOpen(),false,'historical setupComplete cannot bypass a removed metro');
      assert.equal(env.document.getElementById('living-japan-region-pack-panel').querySelector('[data-pack-action="install:metro"]').hidden,false);
      app.destroy();
    } finally {globalThis.fetch=originalFetch;globalThis.document=originalDocument;for(const handle of handles)handle.restore();}
  });
}
