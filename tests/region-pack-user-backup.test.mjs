import test from 'node:test';
import assert from 'node:assert/strict';
import { createBaselineEngine } from '../src/baseline.js';
import { materialOwnFragmentId, materialPackageId } from '../src/material-library.js';
import { placeEditPackageId } from '../src/place-edits.js';
import { createSession } from '../src/session.js';
import { createUserStore } from '../src/storage.js';
import { emptyMaterialRuntime } from './helpers/material-runtime.mjs';

const backup = data => ({format:'living-japan-user-backup',formatVersion:1,productId:'living-japan',data});
const record = (packageId, body) => ({packageId, calendarSegmentId:null, body, slotKey:`P/${packageId}`});
const own = materialPackageId(materialOwnFragmentId('private.term'));
const fragment = materialPackageId('private.fragment');
const slot = 'LJ_USER_private-slot';
const unknown = record('uninstalled-package', '未启用地区的备份正文');
const datedPackage = 'regional-dated', datedSegment = 'sample-day', datedKey = `V/${datedSegment}/${datedPackage}`;
function makeEngine(regional = true) {
  const data = emptyMaterialRuntime();
  data.regionPackageMode = true;
  if (regional) {
    data.packages.push({id:datedPackage,layer:'TN',displayName:'日期分支',
      activation:{kind:'calendar_variant',calendarBodyKey:'sample'}});
    data.calendarSegments.push({id:datedSegment,label:'四月上旬',calendarBodies:{sample:'地区日期内置正文'}});
    data.editableTextSlots.slots[datedKey] = {
      slotKey:datedKey,packageId:datedPackage,calendarSegmentId:datedSegment,bodySha256:'sample-base',
    };
  }
  return createBaselineEngine(data);
}
function datedRecord() {
  const engine = makeEngine(), [variant] = engine.editableVariantsForPackage(datedPackage);
  assert.equal(variant.slotKey, datedKey);
  assert.equal(variant.body, '地区日期内置正文');
  return engine.createOverrideRecord(variant, '地区日期分支');
}
async function setup(initial) {
  let raw = structuredClone(initial), writes = 0;
  const store = createUserStore({transport:{read:async()=>structuredClone(raw),write:async value=>{raw=structuredClone(value);writes++;}}});
  await store.load();
  return {store, writes:()=>writes};
}

test('full backup merges personal data before matching slots in the supplied region-package store', async () => {
  const dated = datedRecord();
  const rows = [record(own,'分类本级正文'),record(fragment,'个人片段正文'),record(slot,'自建空位正文'),dated];
  const incoming = {
    customSlots:{'private-slot':{id:'private-slot',entityId:'user-place:test',name:'新增点',layer:'EX'}},
    placeEdits:{created:{'user-place:test':{name:'新增点',coordinates:{longitude:139.6,latitude:35.7},bindings:[{categoryId:'private.term',enabled:false}]}},overrides:{'builtin:test':{summary:'个人介绍'}}},
    materialLibrary:{
      categories:{'private.term':{id:'private.term',name:'测试分类',layer:'EX',activationKeywords:['备用词']}},
      regions:{'private.region':{id:'private.region',name:'个人区域',parentId:'jp'}},
      fragments:{'private.fragment':{id:'private.fragment',categoryId:'private.term',title:'测试片段',regionId:'private.region',conditions:{months:[12]}}},
      places:{'user-place:test':{id:'user-place:test',name:'新增点',fullNames:['新增点']}},
      bindings:{'private.binding':{id:'private.binding',entityId:'user-place:test',categoryId:'private.term',enabled:false}},
    },
    livingJapanTextOverrides:{records:Object.fromEntries(rows.map(r=>[r.slotKey,r])),orphans:{[unknown.slotKey]:unknown}},
    livingJapanSettings:{historyDepth:0,favoritePlaceIds:['user-place:test'],hiddenPlaceIds:['builtin:test'],peerPlaceQuotas:{'in.culture':0},packages:{'uninstalled-package':false}},
    livingJapanUIPreferences:{panelGeometry:{vertical:{x:10,y:20,width:300,height:500}},mapSplitHeights:{portrait:310}},
    extensionUi:{favorites:[{entityId:'user-place:test'}],theme:'night',pinned:false,layout:'portrait',mapPointVisibility:{hiddenCategoryIds:['ex.open-space']}},
  };
  const source = await setup(incoming);
  const target = await setup({extensionUi:{guide:{completed:true}},livingJapanSettings:{diagnostics:false},
    livingJapanTextOverrides:{records:{[unknown.slotKey]:{...unknown,body:'旧未安装稿'}}}});
  const session = createSession({engine:makeEngine(),store:target.store});
  await session.start();
  try {
    const exported = JSON.parse(source.store.exportBackup());
    assert.deepEqual(exported.data.livingJapanTextOverrides.records[datedKey], dated);
    const preview = target.store.importBackup(exported);
    assert.equal(preview.summary.added,4);
    assert.equal(preview.summary.unresolved,1);
    assert.equal(target.writes(),0);
    const saved = await target.store.applyImport(preview);
    for (const key of ['customSlots','placeEdits','materialLibrary','livingJapanUIPreferences']) assert.deepEqual(saved[key],exported.data[key]);
    assert.deepEqual(saved.livingJapanSettings,{diagnostics:false,...incoming.livingJapanSettings});
    assert.deepEqual(saved.extensionUi,{guide:{completed:true},...incoming.extensionUi});
    assert.equal(Object.hasOwn(saved.livingJapanTextOverrides.records,unknown.slotKey),false);
    assert.deepEqual(saved.livingJapanTextOverrides.orphans[unknown.slotKey],unknown);
    await session.refresh();
    assert.equal((await session.runtime.readTextOverrides()).records[record(own,'').slotKey].body,'分类本级正文');
    assert.deepEqual((await session.runtime.readTextOverrides()).records[datedKey],dated);
  } finally { session.stop(); }
});

test('pack lifecycle keeps inactive bodies and uses only the newest import resolver', async () => {
  const dated = datedRecord();
  const {store} = await setup({livingJapanTextOverrides:{records:{[dated.slotKey]:dated}}});
  const disabled = createSession({engine:makeEngine(false),store});
  await disabled.start();
  const data = backup({livingJapanTextOverrides:{records:{[dated.slotKey]:dated}}});
  assert.equal(store.importBackup(data).summary.unresolved,1);
  assert.deepEqual(store.read().livingJapanTextOverrides.records[dated.slotKey],dated);
  const enabled = createSession({engine:makeEngine(),store});
  await enabled.start();
  disabled.stop();
  try {
    const preview = store.importBackup(data);
    assert.equal(preview.summary.overwritten,1);
    assert.equal(preview.summary.settingsIncluded,false);
    await store.update(draft=>{draft.extensionUi={theme:'night'};});
    await assert.rejects(store.applyImport(preview),{code:'SAVE_CONFLICT'});
    assert.deepEqual(store.read().livingJapanTextOverrides.records[dated.slotKey],dated);
  } finally { enabled.stop(); }
});

test('created-only place backup resolves its正文 without a persisted custom slot', async () => {
  const placeId = 'user-place:created-only';
  const personal = {placeEdits:{created:{[placeId]:{name:'个人落点',coordinates:{longitude:139.6,latitude:35.7}}}}};
  const packageId = placeEditPackageId(placeId), sourceEngine = makeEngine(false).withUserData(personal);
  const [variant] = sourceEngine.editableVariantsForPackage(packageId);
  assert.equal(variant.slotKey, 'P/' + packageId);
  const body = sourceEngine.createOverrideRecord(variant, '矮栏沿人行道排开。');
  const source = await setup({...personal,livingJapanTextOverrides:{records:{[body.slotKey]:body}}});
  const exported = JSON.parse(source.store.exportBackup());
  assert.deepEqual(exported.data.customSlots,{});
  const target = await setup(null);
  const session = createSession({engine:makeEngine(false),store:target.store});
  await session.start();
  try {
    const preview = target.store.importBackup(exported);
    assert.equal(preview.summary.added,1);
    assert.equal(preview.summary.unresolved,0);
    const saved = await target.store.applyImport(preview);
    assert.deepEqual(saved.customSlots,{});
    assert.deepEqual(saved.placeEdits.created[placeId],personal.placeEdits.created[placeId]);
    assert.deepEqual(saved.livingJapanTextOverrides.records[body.slotKey],body);
    await session.refresh();
    assert.deepEqual((await session.runtime.readTextOverrides()).records[body.slotKey],body);
  } finally { session.stop(); }
});
