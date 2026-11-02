import test from 'node:test';
import assert from 'node:assert/strict';
import { createNationalMap } from '../src/national-map.js';
function setup(options={}){
 const handlers=new Map(),texts=[],arcs=[];const context=new Proxy({},{get(_,key){if(key==='measureText')return s=>({width:String(s).length*8});if(key==='clearRect')return()=>{texts.length=0;arcs.length=0;};if(key==='fillText')return s=>texts.push(s);if(key==='arc')return(...args)=>arcs.push(args);return()=>{};},set(){return true;}});
 const canvas={style:{},dataset:{},getContext:()=>context,setAttribute(){},remove(){},addEventListener:(k,v)=>handlers.set(k,v),removeEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:800,height:500}),setPointerCapture(){},releasePointerCapture(){}};
 const entity={id:'hidden-place',name:'隐藏店',coordinates:{longitude:139,latitude:35},regionCode:'13'};
 const catalog={projection:()=>({xScale:1,yScale:1,xOffset:0,yOffset:0}),loadRegion:async()=>({map:{defaultBounds:[138,34,140,36]}}),viewport:async()=>({entities:[entity],roads:[]})};
 const container={style:{},ownerDocument:{createElement:()=>canvas},appendChild(){},getBoundingClientRect:canvas.getBoundingClientRect};
 return {map:createNationalMap(container,{catalog,...options}),handlers,entity,texts,arcs,canvas};
}
const tick=()=>new Promise(r=>setTimeout(r,30));
test('hidden point paints no ordinary, selected, route-label or search-number markers but remains selectable for navigation',async()=>{
 const {map,entity,texts,arcs,canvas}=setup();try{
 await map.setView({regionCode:'13',mode:'ultra',center:[139,35],scale:10});await map.select(entity,{locate:false});map.setRoute(entity,null);map.setSearchResults([entity]);await tick();assert(arcs.length>0);
 map.setHiddenPlaces([entity.id],{});await tick();assert.equal(arcs.length,0);assert.equal(texts.includes(entity.name),false);assert.equal(canvas.dataset.searchMarkerCount,'0');
 await map.locate(entity);assert.deepEqual(map.getView().center,[139,35]);
 }finally{map.destroy();}
});
test('position pick returns exact click coordinates without selecting or appending existing point',async()=>{
 const selections=[],appended=[],picked=[];const {map,handlers}=setup({onSelect:e=>selections.push(e),onAppend:e=>appended.push(e),onPickPosition:p=>picked.push(p)});try{
 await map.setView({regionCode:'13',mode:'ultra',center:[139,35],scale:10});map.setPositionPick(true,null);
 const event={pointerId:1,clientX:410,clientY:230,pointerType:'mouse',type:'pointerup'};handlers.get('pointerdown')(event);handlers.get('pointerup')(event);
 assert.deepEqual(picked,[{longitude:140,latitude:33}]);assert.equal(selections.length,0);handlers.get('dblclick')({...event,preventDefault(){}});assert.equal(appended.length,0);
 }finally{map.destroy();}
});
