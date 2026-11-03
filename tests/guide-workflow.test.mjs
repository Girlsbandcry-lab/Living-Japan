import test from 'node:test';
import assert from 'node:assert/strict';
import * as guide from '../ui/guide.js';
import {createFloatingEntry} from '../src/floating-entry.js';
import {entryDOM,entryStore} from './helpers/entry-dom.mjs';
import fs from 'node:fs';
import vm from 'node:vm';

test('all ten chapters teach the current three-tab workflow and conditions in each real layout',()=>{
  assert.equal(guide.GUIDE_CHAPTERS.length,10);
  for(const layout of ['desktop','portrait','mobile']){
    const steps=guide.guideStepsFor({layout}),copy=steps.map(row=>row.text).join('\n');
    assert.equal(new Set(steps.map(row=>row.id)).size,steps.length);
    for(const required of ['附加资料','待选','独立有效词','上旬','不限地域','跨夜','0','行政区','未对应旧稿'])assert.ok(copy.includes(required),required);
    assert.ok(!copy.includes('两个编辑分页'));
    assert.equal(steps.some(row=>row.key==='window-resize'),layout!=='mobile');
    assert.ok(steps.some(row=>row.open==='conditions'));
  }
});

test('opening a guide editor reuses the live draft and never replaces it with a new place',async()=>{
  const draft={id:'saved',values:{name:'尚未保存'},materials:{pending:['keep']}},calls=[];
  const ui={state:{placeEditor:draft},notify:message=>calls.push(message),placeEditor:{open(){throw Error('must not replace draft');},render(){calls.push('render');}},showPage:async page=>{calls.push(page);return true;}};
  assert.equal(await guide.openGuideStep(ui,{open:'place:bindings'}),true);
  assert.equal(ui.state.placeEditor,draft);assert.equal(draft.tab,'bindings');assert.deepEqual(draft.materials.pending,['keep']);
  assert.equal(await guide.openGuideStep(ui,{open:'place:new'}),false);
  assert.equal(ui.state.placeEditor,draft);assert.equal(draft.values.name,'尚未保存');
});

test('guide refuses to leave a live modal and does not advance or discard its fields',async()=>{
  let routes=0,shown=0,blocked=false;
  const ui={layout:'desktop',state:{page:'region'},bridge:{store:{read:()=>({}),update(){throw Error('unexpected save');}}},showPage:async page=>{routes++;ui.state.page=page;return true;}};
  const session=guide.createGuideSession(ui,{canNavigate:()=>!blocked,onStep(){shown++;}});
  await session.start('edit');blocked=true;ui.state.page='package';
  assert.equal(await session.next(),false);assert.equal(shown,1);assert.equal(routes,0);
});

test('a condition opener expands its existing information panel and only clicks the real edit entry',async()=>{
  const fields={startTime:'22:00',endTime:'02:00'},info={open:false};let opened=0;
  const button={disabled:false,click(){opened++;},closest:()=>info};
  const doc={querySelector:selector=>selector==='[data-reader="conditions"]'?button:null};
  assert.equal(await guide.openGuideStep({state:{},notify(){}},{open:'conditions'},{document:doc}),true);
  assert.equal(info.open,true);assert.equal(opened,1);assert.deepEqual(fields,{startTime:'22:00',endTime:'02:00'});
});

test('guide overlay uses the open host dialog and transforms a scaled iframe target into host coordinates',()=>{
  const host={body:{id:'body'},querySelectorAll:()=>[modal]},modal={open:true,hidden:false,id:'modal'};
  assert.equal(guide.guideLayerHost(host),modal);
  const frame={clientWidth:430,clientHeight:860,getBoundingClientRect:()=>({left:100,top:50,width:215,height:430}),ownerDocument:host};
  const inner={defaultView:{frameElement:frame}},target={ownerDocument:inner,getBoundingClientRect:()=>({left:20,top:40,right:220,bottom:80,width:200,height:40})};
  assert.deepEqual(guide.guideRectInDocument(target,host),{left:110,top:70,right:210,bottom:90,width:100,height:20});
  modal.open=false;assert.equal(guide.guideLayerHost(host),host.body);
});

test('explicit quick-menu teaching opens the real menu without saving or changing switches',async()=>{
  const env=entryDOM(),store=entryStore({livingJapanSettings:{layers:{TN:false}}}),before=store.read();
  const entry=createFloatingEntry({...env,store,open(){}});
  assert.equal(typeof entry.openMenu,'function');
  await guide.openGuideStep({state:{},bridge:{guideHost:{openQuickMenu:()=>entry.openMenu()}},notify(){}},{open:'quick-menu'});
  assert.equal(env.document.getElementById('living-japan-floating-menu').hidden,false);assert.deepEqual(store.read(),before);entry.destroy();
});

test('every guide opener respects an existing inner or host modal before navigating or opening another surface',async()=>{
  for(const surface of ['inner','host']){
    let operations=0;const modal={contains:()=>false},other={querySelector:()=>null};
    const blocked={querySelector:selector=>selector==='dialog[open]'?modal:null};
    const ui={state:{placeEditor:{id:'draft',values:{name:'keep'}}},notify(){},showPage:async()=>{operations++;return true;},placeEditor:{render(){operations++;}},bridge:{guideHost:{document:surface==='host'?blocked:other,openQuickMenu(){operations++;}},openPackages(){operations++;}}};
    for(const open of ['quick-menu','packs','place:data','place:new','reader-info'])assert.equal(await guide.openGuideStep(ui,{open},{document:surface==='inner'?blocked:other}),false,open+' '+surface);
    assert.equal(operations,0);assert.equal(ui.state.placeEditor.values.name,'keep');
  }
  let clicks=0;const target={disabled:false,click(){clicks++;},closest:()=>null},modal={contains:node=>node===target};
  const doc={querySelector:selector=>selector==='dialog[open]'?modal:selector==='dialog[open] [data-choice="category"]'?target:null};
  assert.equal(await guide.openGuideStep({state:{},notify(){}},{open:'category-form'},{document:doc}),true);assert.equal(clicks,1);
});

test('the actual workspace close only removes its host guide after the leave check succeeds',async()=>{
  const source=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  const closeSource=source.slice(source.indexOf('  async function close()'),source.indexOf('  async function open()'));
  for(const accepted of [false,true]){
    let closes=0;const shell={hidden:false},shellViewport={hidden:false};
    const close=vm.runInNewContext(closeSource+';close',{frame:{contentWindow:{LivingJapanView:{leave:async()=>accepted,ui:{guide:{close(){closes++;}}}}}},geometrySave:Promise.resolve(),shell,shellViewport,entry:{setOpen(){}}});
    await close();assert.equal(closes,accepted?1:0);assert.equal(shell.hidden,accepted);assert.equal(shellViewport.hidden,accepted);
  }
});

test('the add-material step follows the open picker after its original add button disappears',()=>{
  const step=guide.guideStepsFor({layout:'portrait'},'bindings').find(row=>row.title==='打开添加词条');
  const add={id:'add'},picker={id:'picker'};let opened=false;
  const find=selector=>selector.split(',').map(value=>value.trim()).map(value=>value==='[data-pm-action="add"]'&&!opened?add:value==='.lj-material-layer-grid'&&opened?picker:null).find(Boolean)||null;
  assert.deepEqual(guide.guideStepTarget(step,find),{target:add,missing:false,hint:''});
  opened=true;
  assert.deepEqual(guide.guideStepTarget(step,find),{target:picker,missing:false,hint:''});
});
