import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlaceMaterialIndex, materialPickerPage, togglePendingMaterial, commitPendingMaterials, materialPreviewVersions, createPlaceMaterialsPanel } from '../ui/place-materials.js';
import { createPlaceDraft, createPlaceEditor } from '../ui/place-editor.js';

const categories = [
  {id:'tn.plants',name:'植物与植被',layer:'TN'},
  {id:'tn.tree',name:'行道树',layer:'TN',parentId:'tn.plants'},
  {id:'ex.green',name:'植物与绿化',layer:'EX'},
  {id:'ex.tree',name:'行道树',layer:'EX',parentId:'ex.green'},
  {id:'in.type',name:'店铺类型',layer:'IN',nodeRole:'place_type',canOwnBody:false},
  {id:'in.type.child',name:'咖啡店',layer:'IN',parentId:'in.type',nodeRole:'place_type'},
  {id:'in.tag',name:'露台',layer:'IN',parentId:'in.type.child',nodeRole:'feature'},
  {id:'in.tag.child',name:'遮阳棚',layer:'IN',parentId:'in.tag',nodeRole:'feature'},
];
const state = (patch={}) => ({group:'ordinary',layer:'',parentId:null,query:'',list:'browse',page:0,pending:[],...patch});

test('same-name terms retain independent IDs and full real classification paths',()=>{
  const model=buildPlaceMaterialIndex(categories);
  const result=materialPickerPage(model,state({query:'行道树'}),[]);
  assert.deepEqual(result.rows.map(row=>row.id),['tn.tree','ex.tree']);
  assert.equal(result.rows[0].pathText,'天气与四季 › 植物与植被 › 行道树');
  assert.equal(result.rows[1].pathText,'街区与户外 › 植物与绿化 › 行道树');
  assert.deepEqual(materialPickerPage(model,state({query:'街区 行道树'}),[]).rows.map(row=>row.id),['ex.tree']);
});

test('ordinary descendants of type nodes stay reachable without inventing a parent path',()=>{
  const model=buildPlaceMaterialIndex(categories);
  assert.deepEqual(materialPickerPage(model,state({layer:'IN'}),[]).rows.map(row=>row.id),['in.tag']);
  assert.deepEqual(materialPickerPage(model,state({layer:'IN',parentId:'in.tag'}),[]).rows.map(row=>row.id),['in.tag.child']);
  assert.equal(model.byId.get('in.tag').pathText,'场馆与店铺 › 店铺类型 › 咖啡店 › 露台');
  assert.deepEqual(materialPickerPage(model,state({group:'types'}),[]).rows.map(row=>row.id),['in.type']);
  assert.equal(model.byId.get('in.type').category.canOwnBody,false);
});

test('selecting parent and child is independent; paused links cannot be reactivated by adding',()=>{
  const choice=state(),bindings=[{categoryId:'in.tag',enabled:false,custom:'preserve'}];
  togglePendingMaterial(choice,bindings,'in.type');
  togglePendingMaterial(choice,bindings,'in.type.child');
  togglePendingMaterial(choice,bindings,'in.tag');
  assert.deepEqual(choice.pending,['in.type','in.type.child']);
  togglePendingMaterial(choice,bindings,'in.type');
  assert.deepEqual(choice.pending,['in.type.child']);
  assert.deepEqual(bindings,[{categoryId:'in.tag',enabled:false,custom:'preserve'}]);
  const draft={bindings,materials:choice};commitPendingMaterials(draft);
  assert.deepEqual(draft.bindings,[{categoryId:'in.tag',enabled:false,custom:'preserve'},{categoryId:'in.type.child',enabled:true}]);
  assert.deepEqual(choice.pending,[]);
});

test('search and pagination keep all results and new selections across views',()=>{
  const model=buildPlaceMaterialIndex(Array.from({length:101},(_,n)=>({id:'row'+n,name:'候选'+n,layer:'EX'})));
  const choice=state({query:'候选'}),bindings=[];
  togglePendingMaterial(choice,bindings,'row80');
  const first=materialPickerPage(model,choice,bindings);
  assert.equal(first.rows.length,48);assert.equal(first.total,101);assert.equal(first.pageCount,3);
  choice.page=1;const second=materialPickerPage(model,choice,bindings);
  choice.page=2;const third=materialPickerPage(model,choice,bindings);
  assert.equal(new Set([...first.rows,...second.rows,...third.rows].map(row=>row.id)).size,101);
  choice.list='pending';const pending=materialPickerPage(model,choice,bindings);
  assert.deepEqual(pending.rows.map(row=>row.id),['row80']);assert.equal(pending.page,0);
});

test('a new index reads refreshed classifications and does not retain a stale catalogue',()=>{
  const initial=buildPlaceMaterialIndex(categories);
  const changed=buildPlaceMaterialIndex([...categories,{id:'new',name:'新词条',layer:'EV'}]);
  assert.equal(initial.byId.has('new'),false);
  assert.deepEqual(materialPickerPage(changed,state({layer:'EV'}),[]).rows.map(row=>row.id),['new']);
});

test('preview versions include only this category direct bodies and conditions, never child text',()=>{
  const data={materialLibrary:{categories:Object.fromEntries(categories.map(row=>[row.id,row])),regions:{jp:{id:'jp',name:'全国'}},fragments:{own:{id:'own',categoryId:'in.type',ownBody:true,regionId:'jp',conditions:{}},direct:{id:'direct',categoryId:'in.type',title:'夜间',regionId:'jp',conditions:{startTime:'18:00',endTime:'23:00'}},child:{id:'child',categoryId:'in.type.child',title:'子项',regionId:'jp',conditions:{}}}},packages:[{id:'p1',materialFragmentId:'own'},{id:'p2',materialFragmentId:'direct'},{id:'p3',materialFragmentId:'child'}]};
  const versions=materialPreviewVersions({data,editableVariantsForPackage:id=>[{packageId:id,slotKey:'P/'+id}]},'in.type');
  assert.deepEqual(versions.map(row=>row.packageId),['p1','p2']);
  assert.equal(versions[1].conditions,'全国 · 18:00 至 23:00');
  assert.equal(versions[1].slotKey,'P/p2');
});

test('chooser actions cancel only new selections, keep paused links, and remove the final link explicitly',async()=>{
  const draft={bindings:[{categoryId:'tn.tree',enabled:false}],snapshot:{permissions:{structure:true}}};
  const ui={state:{placeEditor:draft},engine:{data:{materialLibrary:{categories:Object.fromEntries(categories.map(row=>[row.id,row]))}}}};
  const panel=createPlaceMaterialsPanel(ui,{render(){},getHost:()=>null,changed(){}});
  const act=(pmAction,details={})=>panel.action({dataset:{pmAction,...details}});
  await act('add');togglePendingMaterial(draft.materials,draft.bindings,'ex.tree');
  await act('types');await act('children',{id:'in.type'});await act('up');
  assert.equal(draft.materials.layer,'','back from a type root restores all type families');
  assert.deepEqual(draft.materials.pending,['ex.tree']);
  await act('cancel-choice');assert.deepEqual(draft.materials.pending,[]);
  assert.deepEqual(draft.bindings,[{categoryId:'tn.tree',enabled:false}]);
  await act('toggle',{id:'tn.tree'});assert.equal(draft.bindings[0].enabled,true);
  await act('remove',{id:'tn.tree'});assert.deepEqual(draft.bindings,[]);
  await act('add');togglePendingMaterial(draft.materials,draft.bindings,'ex.tree');
  await act('complete');assert.deepEqual(draft.bindings,[{categoryId:'ex.tree',enabled:true}]);
});

test('preview loads exactly the selected version and passes its slot back to the shared editor',async()=>{
  const fragments={a:{id:'a',categoryId:'tn.tree',ownBody:true,regionId:'north',conditions:{}},b:{id:'b',categoryId:'tn.tree',ownBody:true,regionId:'south',conditions:{}}};
  const calls=[],edits=[],draft={bindings:[],snapshot:{permissions:{structure:true}}};
  const ui={state:{placeEditor:draft},engine:{data:{materialLibrary:{categories:Object.fromEntries(categories.map(row=>[row.id,row])),regions:{north:{name:'北部'},south:{name:'南部'}},fragments},packages:[{id:'p1',materialFragmentId:'a'},{id:'p2',materialFragmentId:'b'}]},editableVariantsForPackage:id=>[{packageId:id,slotKey:'P/'+id}]},bridge:{session:{ensureBodies:async ids=>calls.push(ids)}},editPlaceMaterial:async(...args)=>edits.push(args)};
  const panel=createPlaceMaterialsPanel(ui,{render(){},getHost:()=>null,changed(){}});
  await panel.action({dataset:{pmAction:'preview',id:'tn.tree'}});
  assert.deepEqual(calls,[['p1']]);
  await panel.change({target:{dataset:{},value:'P/p2',hasAttribute:name=>name==='data-pm-version'}});
  assert.deepEqual(calls,[['p1'],['p2']]);
  await panel.action({dataset:{pmAction:'edit-material'}});
  assert.deepEqual(edits,[['p2','P/p2']]);
});

test('failed body reads stay distinct from an empty version and can be retried',async()=>{
  let attempts=0;
  const notices=[],draft={bindings:[],snapshot:{permissions:{structure:true}}};
  const ui={state:{placeEditor:draft},engine:{data:{materialLibrary:{categories:{tree:categories[1]},regions:{jp:{name:'全国'}},fragments:{a:{id:'a',categoryId:'tn.tree',ownBody:true,regionId:'jp',conditions:{}}}},packages:[{id:'p1',materialFragmentId:'a'}]},editableVariantsForPackage:()=>[{packageId:'p1',slotKey:'P/p1',body:''}],normalizeTextOverrides:()=>({records:{}})},bridge:{store:{read:()=>({})},session:{ensureBodies:async()=>{if(++attempts===1)throw new Error('读取连接中断');}}},notify:(...args)=>notices.push(args)};
  const panel=createPlaceMaterialsPanel(ui,{render(){},getHost:()=>null,changed(){}});
  await panel.action({dataset:{pmAction:'preview',id:'tn.tree'}});
  assert.equal(draft.materials.preview.error,'读取连接中断');assert.equal(notices.length,1);
  const failed=panel.markup(draft,false).content;
  assert.match(failed,/正文读取失败/);assert.match(failed,/retry-preview/);assert.doesNotMatch(failed,/此版本暂无正文/);
  await panel.action({dataset:{pmAction:'retry-preview'}});
  assert.equal(attempts,2);assert.equal(draft.materials.preview.error,'');
  assert.match(panel.markup(draft,false).content,/此版本暂无正文/);
});

test('an older version request cannot clear a newer loading state or permit editing it early',async()=>{
  const deferred=[],edits=[],draft={bindings:[],snapshot:{permissions:{structure:true}}};
  const ui={state:{placeEditor:draft},engine:{data:{materialLibrary:{categories:Object.fromEntries(categories.map(row=>[row.id,row])),regions:{jp:{name:'全国'}},fragments:{a:{id:'a',categoryId:'tn.tree',ownBody:true,regionId:'jp',conditions:{}},b:{id:'b',categoryId:'tn.tree',title:'第二版本',regionId:'jp',conditions:{}}}},packages:[{id:'p1',materialFragmentId:'a'},{id:'p2',materialFragmentId:'b'}]},editableVariantsForPackage:id=>[{packageId:id,slotKey:'P/'+id}],normalizeTextOverrides:()=>({records:{}})},bridge:{store:{read:()=>({})},session:{ensureBodies:ids=>new Promise(resolve=>deferred.push({ids,resolve}))}},editPlaceMaterial:async(...args)=>edits.push(args)};
  const panel=createPlaceMaterialsPanel(ui,{render(){},getHost:()=>null,changed(){}});
  const first=panel.action({dataset:{pmAction:'preview',id:'tn.tree'}});
  const second=panel.change({target:{dataset:{},value:'P/p2',hasAttribute:name=>name==='data-pm-version'}});
  assert.equal(draft.materials.preview.loading,true);
  assert.match(panel.markup(draft,false).footer,/data-pm-action="edit-material"[^>]*disabled/);
  deferred[0].resolve();await first;
  assert.equal(draft.materials.preview.loading,true,'first request does not finish the second one');
  assert.equal(draft.materials.preview.slotKey,'P/p2');
  await panel.action({dataset:{pmAction:'edit-material'}});assert.deepEqual(edits,[]);
  deferred[1].resolve();await second;
  assert.equal(draft.materials.preview.loading,false);
  await panel.action({dataset:{pmAction:'edit-material'}});assert.deepEqual(edits,[['p2','P/p2']]);
});

test('a failed place save submits pending selections without changing the retained chooser draft',async()=>{
  const beforeDocument=globalThis.document,payloads=[];
  globalThis.document={querySelector:()=>({}),body:{classList:{remove(){}}}};
  try{
    const draft=createPlaceDraft({id:'place:1',isNew:false,values:{name:'原名'},builtin:{},bodyVariants:[],bindings:[],overriddenFields:[],permissions:{structure:true,coordinates:true}});
    draft.values.name='未保存地点';
    draft.materials={view:'preview',query:'行道树',page:2,pending:['ex.tree'],preview:{categoryId:'ex.tree',slotKey:'P/p1',from:'choose'},positions:{'choose:2':{top:180}}};
    const before=structuredClone(draft);
    const ui={state:{page:'package',placeEditor:draft},bridge:{session:{runtime:{savePlaceEdit:async(id,payload)=>{payloads.push(payload);throw new Error('写入失败');}}}},notify(){}};
    const editor=createPlaceEditor(ui);
    assert.equal(await editor.save(),false);
    assert.deepEqual(payloads[0].bindings,[{categoryId:'ex.tree',enabled:true}]);
    assert.deepEqual(draft,before,'pending, preview, query, scroll and place fields survive the rejected save');
  }finally{globalThis.document=beforeDocument;}
});
