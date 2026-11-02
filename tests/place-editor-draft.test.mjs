import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaceDraft, createPlaceEditor, placeDraftPayload, restorePlaceDraftField, restorePlaceDraftAll } from '../ui/place-editor.js';

const snapshot = () => ({ id:'test:1',isNew:false,values:{name:'当前名',type:'咖啡店',fullNames:['当前名'],summary:'介绍',coordinates:{longitude:139,latitude:35}},builtin:{name:'新版原名',summary:'新版介绍'},permissions:{structure:true,coordinates:false},bodyVariants:[{slotKey:'body:1',body:'修改文',builtinBody:'新版原文',custom:false,userSlot:false},{slotKey:'body:user',body:'自加文',builtinBody:'',custom:true,userSlot:true}],bindings:[],overriddenFields:['name'] });

test('editing fields and text has no snapshot side effects; saving sends only changed fields',()=>{
 const input=snapshot(),draft=createPlaceDraft(input); draft.values.name='草稿名';draft.bodies['body:1']='';
 assert.equal(input.values.name,'当前名');assert.equal(input.bodyVariants[0].body,'修改文');
 assert.deepEqual(placeDraftPayload(draft).fields,{name:'草稿名'});assert.deepEqual(placeDraftPayload(draft).bodies,{'body:1':''});
});
test('field restore is staged and later editing cancels the restoration',()=>{
 const draft=createPlaceDraft(snapshot());restorePlaceDraftField(draft,'name');
 assert.equal(draft.values.name,'新版原名');assert.deepEqual(placeDraftPayload(draft).restoreFields,['name']);
 draft.values.name='另一个名字';assert.deepEqual(placeDraftPayload(draft).fields,{name:'另一个名字'});assert.deepEqual(placeDraftPayload(draft).restoreFields,[]);
});
test('restore all keeps extra user body slots and restores only builtin bodies',()=>{
 const draft=createPlaceDraft(snapshot());restorePlaceDraftAll(draft);
 assert.equal(draft.bodies['body:1'],'新版原文');assert.equal(draft.bodies['body:user'],'自加文');
 assert.equal(placeDraftPayload(draft).restoreAll,true);
});
test('existing personal text overrides can be staged for restoration',()=>{
 const input=snapshot();input.bodyVariants[0].custom=true;const draft=createPlaceDraft(input);restorePlaceDraftAll(draft);
 assert.equal(draft.bodies['body:1'],'新版原文');assert.deepEqual(placeDraftPayload(draft).restoreBodies,['body:1']);
 draft.bodies['body:1']='修改文';assert.deepEqual(placeDraftPayload(draft).bodies,{'body:1':'修改文'});
});
test('binding restoration removes the override without storing another binding copy',()=>{
 const input=snapshot();input.bindings=[{categoryId:'personal',enabled:true}];input.builtin.bindings=[{categoryId:'builtin',enabled:true}];
 const draft=createPlaceDraft(input);draft.bindings=structuredClone(input.builtin.bindings);draft.restoreFields.push('bindings');
 const payload=placeDraftPayload(draft);assert.deepEqual(payload.restoreFields,['bindings']);assert.equal(Object.hasOwn(payload,'bindings'),false);
});
test('new place saves its default parent and region along with all visible fields',()=>{
 const input=snapshot();input.isNew=true;input.values.parentId='parent:1';input.values.regionCode='13';
 const draft=createPlaceDraft(input);assert.deepEqual(placeDraftPayload(draft).fields,input.values);
});

test('an untouched new place cancels without confirmation while actual field, text, location and binding changes remain dirty',()=>{
 const previous=globalThis.document;
 globalThis.document={querySelector:()=>({})};
 try {
  const input=snapshot();input.isNew=true;input.values.name='';input.values.fullNames=[];input.values.summary='';input.values.coordinates=null;input.bodyVariants=input.bodyVariants.map(row=>({...row,body:''}));
  const draft=createPlaceDraft(input),ui={state:{placeEditor:draft},bridge:{session:{runtime:{}}}},editor=createPlaceEditor(ui);
  assert.equal(editor.dirty(),false);
  draft.tab='text';draft.bodyKey='body:user';draft.parentQuery='临时搜索';
  assert.equal(editor.dirty(),false);
  for(const [field,value]of [['name','新名'],['type','公园'],['fullNames',['完整词']],['summary','一句话'],['coordinates',{longitude:140,latitude:36}]]){
   const before=structuredClone(draft.values[field]);draft.values[field]=value;assert.equal(editor.dirty(),true,field);draft.values[field]=before;assert.equal(editor.dirty(),false,field+' restored');
  }
  draft.bodies['body:1']='正文';assert.equal(editor.dirty(),true);draft.bodies['body:1']='';assert.equal(editor.dirty(),false);
  draft.bindings=[{categoryId:'in.food',enabled:true}];assert.equal(editor.dirty(),true);draft.bindings=[];assert.equal(editor.dirty(),false);
  ui.state.placeEditor=createPlaceDraft(snapshot());assert.equal(editor.dirty(),false);
  restorePlaceDraftField(ui.state.placeEditor,'name');assert.equal(editor.dirty(),true,'existing field restoration is pending work');
 }finally{globalThis.document=previous;}
});
