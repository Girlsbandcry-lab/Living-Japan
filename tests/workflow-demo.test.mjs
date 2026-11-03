import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowData, createWorkflowStore, DEMO_CHAT, DEMO_IDS } from '../src/workflow-demo-data.js';
import { loadBaseline, createBaselineEngine } from '../src/baseline.js';
import { createCatalog } from '../src/catalog.js';
import { createCanonicalContextPreparer } from '../src/place-identities.js';
import { createSession } from '../src/session.js';
import { loadTransitService } from '../src/transit-service.js';
import { materialOwnFragmentId, materialPackageId } from '../src/material-library.js';
import { emptyMaterialRuntime } from './helpers/material-runtime.mjs';
import { WORKFLOW_CHAPTERS } from '../ui/workflow-chapters.js';
import { WORKFLOW_ACTIONS, waitForWorkflow } from '../ui/workflow-actions.js';

async function demo() {
  const fixture=createWorkflowData(emptyMaterialRuntime()),baseUrl='https://workflow.invalid/';
  const baseline=await loadBaseline(baseUrl,{fetcher:fixture.fetcher,lazyTexts:true,metroNames:{}});
  const catalog=createCatalog({baseData:baseline.data,baseUrl,fetcher:fixture.fetcher,useWorker:false});
  const index=await catalog.loadIndex();
  const prepareUserData=await createCanonicalContextPreparer({data:baseline.data,catalog,index,baseUrl,fetcher:fixture.fetcher});
  const store=await createWorkflowStore(fixture.user);
  await prepareUserData(store.read());
  const context={chat:[{is_user:true,mes:DEMO_CHAT}]};
  const session=createSession({engine:createBaselineEngine(baseline.data),store,prepareUserData,context,textResources:baseline.textResources});
  await session.start();
  return {fixture,baseUrl,baseline,catalog,store,session,context,close(){session.stop();catalog.destroy();}};
}

test('the demonstration copies current wrappers, owns memory only and cannot fetch unregistered resources',async()=>{
  const source=emptyMaterialRuntime(),before=structuredClone(source.wrappers);
  const fixture=createWorkflowData(source),store=await createWorkflowStore(fixture.user);
  assert.deepEqual(fixture.runtime.wrappers,source.wrappers);
  fixture.runtime.wrappers.background.before='demo mutation';
  assert.deepEqual(source.wrappers,before);
  const original=structuredClone(fixture.user);
  await store.update(data=>{data.livingJapanSettings.wrapperMode='detailed';return data;});
  assert.deepEqual(fixture.user,original);
  const fresh=await createWorkflowStore(fixture.user);
  assert.equal(fresh.read().livingJapanSettings.wrapperMode,'background');
  assert.equal((await fixture.fetcher('https://external.invalid/unregistered')).status,404);
});

test('the real catalog and session find the nested example and quota zero visibly removes only its peer',async()=>{
  const f=await demo();try{
    assert.deepEqual(f.fixture.rows.find(row=>row.id===DEMO_IDS.court).typePathIds,['layer:EX','ex.open-space','ex.open-space.garden']);
    assert.equal(f.fixture.rows.find(row=>row.id===DEMO_IDS.hall).type,'文化会馆');
    const matches=await f.catalog.search('木窗',{regionCode:'metro'});
    assert.ok(matches.some(row=>row.id===DEMO_IDS.cafe));
    const before=await f.session.preview();
    assert.match(before.prompt,/石阶咖啡角：石阶旁的小咖啡馆/);
    assert.match(before.prompt,/木窗和长桌构成靠窗/);
    assert.match(before.prompt,/庭院会馆/);
    assert.match(before.prompt,/林荫庭院/);
    await f.session.runtime.saveSettings({...await f.session.runtime.readSettings(),peerPlaceQuotas:{'in.food.cafe':0}});
    const after=await f.session.preview();
    assert.doesNotMatch(after.prompt,/石阶咖啡角/);
    assert.match(after.prompt,/木窗和长桌构成靠窗/);
    assert.match(after.prompt,/木窗咖啡店开在/);
    assert.equal(f.session.runtime.isMacroRegistered(),false);
    assert.equal(f.session.runtime.getLastActualInjection(),null);
  }finally{f.close();}
});

test('saving example material text, keywords and conditions uses the real engine and remains independent',async()=>{
  const f=await demo();try{
    const id=materialOwnFragmentId(DEMO_IDS.rain),library=structuredClone(f.session.engine.data.materialLibrary);
    library.categories[DEMO_IDS.rain].activationKeywords=['雨天檐下'];
    library.fragments[id]={...library.fragments[id],regionId:'@any',conditions:{months:[4],startTime:'15:00',endTime:'20:59',weatherTypes:['light_rain']}};
    await f.session.runtime.saveMaterialLibrary(library);
    await f.session.runtime.saveTextOverride(materialPackageId(id),null,'演示雨水沿檐口落下。');
    f.context.chat=[{is_user:true,mes:'4月12日，18:00，小雨。示例县示例市，木窗咖啡店，雨天檐下。'}];
    assert.match((await f.session.preview()).prompt,/演示雨水沿檐口落下/);
    f.context.chat=[{is_user:true,mes:'7月12日，18:00，晴天。示例县示例市，木窗咖啡店，雨天檐下。'}];
    assert.doesNotMatch((await f.session.preview()).prompt,/演示雨水沿檐口落下/);
    assert.deepEqual(f.fixture.user.materialLibrary.fragments,{});
  }finally{f.close();}
});

test('example travel uses the existing estimator and its explicitly supplied grid',async()=>{
  const f=await demo();try{
    const transit=await loadTransitService({baseline:f.baseline,baseData:f.session.engine.data,baseUrl:f.baseUrl,fetcher:f.fixture.fetcher});
    const result=transit.estimateAll({origin:f.fixture.rows.find(row=>row.id===DEMO_IDS.cafe),destination:f.fixture.rows.find(row=>row.id===DEMO_IDS.court)});
    assert.equal(result.estimates.walking.ok,true);
    assert.ok(result.estimates.walking.minutes>0);
    assert.equal(result.estimates.walking.gridPair.originCellId,'grid_00_00');
    assert.equal(result.estimates.public_transit.ok,false);
  }finally{f.close();}
});

test('every chapter action has a driver and waits fail instead of silently skipping a missing target',async()=>{
  for(const chapter of WORKFLOW_CHAPTERS)for(const step of chapter.steps)assert.ok(WORKFLOW_ACTIONS.includes(step.action),chapter.id+':'+step.action);
  let count=0;assert.equal(await waitForWorkflow(async()=>++count===2?'ready':false,'ready',100),'ready');
  await assert.rejects(waitForWorkflow(()=>false,'missing target',1),/missing target：界面未就绪/);
});
