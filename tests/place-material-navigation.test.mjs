import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaceMaterialNavigation } from '../ui/place-material-navigation.js';

function fixture() {
  const calls=[];
  const ui={state:{page:'region',placeEditor:{id:'p',values:{name:'测试地点'}}},
    engine:{data:{packages:[{id:'body',materialFragmentId:'fragment'}]},editableVariantsForPackage:()=>[{slotKey:'body:default'}]},
    bridge:{session:{ensureBodies:async ids=>calls.push(['load',ids])}},
    getEntityForPackage:id=>({id:'fragment',materialFragmentId:'fragment',packageIds:[id]}),
    notify:message=>calls.push(['notice',message]),
    locateMaterialNode:async id=>{calls.push(['locate',id]);ui.state.page='package';return true;},
    reader:{open:async (...args)=>{calls.push(['open',...args]);return true;}},
    showPage:async page=>{calls.push(['page',page]);if(ui.blockLeave)return false;ui.state.page=page;return true;},
  };
  Object.assign(ui,createPlaceMaterialNavigation(ui));
  return {ui,calls};
}

test('material navigation opens the requested version and returns to the retained draft',async()=>{
  const {ui,calls}=fixture(),draft=ui.state.placeEditor;
  assert.equal(await ui.editPlaceMaterial('body','body:default'),true);
  assert.equal(ui.canReturnToPlace(),true);
  assert.deepEqual(calls.find(row=>row[0]==='open').at(-1),{mode:'edit',slotKey:'body:default'});
  assert.equal(await ui.returnToPlace(),true);
  assert.equal(ui.state.placeEditor,draft);
  assert.equal(ui.state.page,'region');
  assert.equal(ui.canReturnToPlace(),false);
});

test('declining reader leave retains both the return route and place draft',async()=>{
  const {ui}=fixture(),draft=ui.state.placeEditor;
  await ui.editPlaceMaterial('body');ui.blockLeave=true;
  assert.equal(await ui.returnToPlace(),false);
  assert.equal(ui.canReturnToPlace(),true);
  assert.equal(ui.state.placeEditor,draft);
  ui.blockLeave=false;
  assert.equal(await ui.returnToPlace(),true);
});

test('old return route cannot reopen a saved, discarded or replacement place draft',async()=>{
  const {ui}=fixture();await ui.editPlaceMaterial('body');
  ui.state.placeEditor={...ui.state.placeEditor};
  assert.equal(ui.canReturnToPlace(),false);
  assert.equal(await ui.returnToPlace(),false);
});

test('missing package or requested version does not navigate to another body',async()=>{
  const {ui,calls}=fixture();
  assert.equal(await ui.editPlaceMaterial('missing'),false);
  assert.equal(await ui.editPlaceMaterial('body','missing-slot'),false);
  assert.equal(calls.some(row=>row[0]==='open'||row[0]==='locate'),false);
  assert.equal(ui.state.page,'region');
});

test('failed material navigation restores the editor without losing its pending selections',async()=>{
  const {ui}=fixture();ui.state.placeEditor.materials={pending:['new']};
  ui.locateMaterialNode=async()=>{ui.state.page='package';throw new Error('定位失败');};
  await assert.rejects(ui.editPlaceMaterial('body'),/定位失败/);
  assert.equal(ui.state.page,'region');
  assert.deepEqual(ui.state.placeEditor.materials.pending,['new']);
});

test('declining entry does not request leave a second time',async()=>{
  const {ui,calls}=fixture();ui.locateMaterialNode=async()=>false;
  assert.equal(await ui.editPlaceMaterial('body'),false);
  assert.equal(calls.some(row=>row[0]==='page'),false);
  assert.equal(ui.canReturnToPlace(),false);
});

test('return clicks share one leave decision',async()=>{
  const {ui}=fixture();await ui.editPlaceMaterial('body');
  let resolveLeave,calls=0;
  ui.showPage=()=>{calls++;return new Promise(resolve=>{resolveLeave=resolve;});};
  const first=ui.returnToPlace();
  assert.equal(await ui.returnToPlace(),false);assert.equal(calls,1);
  resolveLeave(false);assert.equal(await first,false);assert.equal(ui.canReturnToPlace(),true);
});
