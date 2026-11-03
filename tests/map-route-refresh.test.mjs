import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouteRefresh, mountMap } from '../ui/map.js';
import { esc } from '../ui/dom.js';
import { createCatalog } from '../src/catalog.js';
import { placeEditSlotId } from '../src/place-edits.js';

const point=(id,name,longitude)=>({id,name,kind:'content_object',type:'公园',regionCode:'13',coordinates:{longitude,latitude:35.7}});
const modes=['public_transit','driving','walking','bicycle'];
function fixture({loadService,estimateAll}={}) {
  const origin=point('a','起点',139.7),destination=point('b','终点',139.8);
  const state={routeOrigin:origin,routeDestination:destination,travelMode:'walking'};
  const rows=new Map([['a',origin],['b',destination]]),calls=[],changes=[],remembered=[];
  const service={estimateAll:estimateAll||(({origin,destination})=>{
    calls.push(structuredClone({origin,destination}));
    const minutes=Math.round(Math.abs(origin.coordinates.longitude-destination.coordinates.longitude)*1000);
    return {origin:{...origin,label:origin.name},destination:{...destination,label:destination.name},estimates:Object.fromEntries(modes.map(mode=>[mode,{ok:true,minutes,routeSummary:origin.name+' → '+destination.name}]))};
  })};
  const refresh=createRouteRefresh({state,getLatest:entity=>{const current=rows.get(entity.id)||entity;remembered.push(current);return current;},loadService:loadService||(()=>Promise.resolve(service)),onChange:value=>changes.push(value)});
  return {state,rows,calls,changes,remembered,service,refresh};
}
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};

test('same-ID origin and destination coordinate edits use current catalog objects and recalculate all modes',async()=>{
  const f=fixture(),oldOrigin=f.state.routeOrigin,oldDestination=f.state.routeDestination;
  await f.refresh.refresh();assert.equal(f.calls.length,1);
  const origin=point('a','起点',139.72);f.rows.set('a',origin);
  await f.refresh.refresh();assert.equal(f.calls.length,2);
  assert.equal(f.state.routeOrigin,origin);assert.equal(f.state.routeDestination,oldDestination);
  assert.equal(f.calls[1].origin.coordinates.longitude,139.72);
  assert.equal(oldOrigin.coordinates.longitude,139.7,'saved refresh does not mutate the old selected snapshot');
  const destination=point('b','终点',139.9);f.rows.set('b',destination);
  await f.refresh.refresh();assert.equal(f.calls.length,3);
  assert.equal(f.state.routeDestination,destination);
  for(const mode of modes)assert.equal(f.refresh.snapshot().estimates[mode].minutes,180);
  assert.equal(f.refresh.snapshot().selectedEndpoints.destination.coordinates.longitude,139.9);
  assert.equal(f.state.travelMode,'walking');
});

test('real catalog retains updated created endpoints when a coordinate edit first creates a primary text slot',async()=>{
  const f=fixture(),catalog=createCatalog({useWorker:false,fetcher:()=>assert.fail('personal place refresh needs no remote data')});
  const created={a:point('a','起点',139.7),b:point('b','终点',139.8)};
  const refresh=createRouteRefresh({state:f.state,getLatest:entity=>catalog.get(entity.id)||entity,loadService:()=>f.service,onChange:()=>{}});
  try {
    catalog.setPersonalPlaces({placeEdits:{created}});
    await refresh.refresh();assert.equal(f.calls.length,1);
    const updated={...created,a:{...created.a,coordinates:{longitude:139.6,latitude:35.7}}},slotId=placeEditSlotId('a');
    const customSlots={[slotId]:{...updated.a,id:slotId,entityId:'a',title:updated.a.name,layer:'EX',placeEditPrimary:true}};
    catalog.setPersonalPlaces({placeEdits:{created:updated},customSlots});
    await refresh.refresh();
    assert.equal(f.calls.length,2,'saving coordinates with the first text slot must recalculate the selected route');
    assert.equal(catalog.get('a').coordinates.longitude,139.6);
    assert.equal(catalog.get('b').coordinates.longitude,139.8,'the unchanged created destination also survives snapshot invalidation');
    assert.equal(f.state.routeOrigin,catalog.get('a'));assert.equal(f.state.routeDestination,catalog.get('b'));
    for(const mode of modes)assert.equal(refresh.snapshot().estimates[mode].minutes,200);
    assert.equal(f.state.travelMode,'walking');
    catalog.setPersonalPlaces({placeEdits:{created:{b:updated.b}}});
    assert.equal(catalog.get('a'),null,'removed created places are still evicted');
    assert.equal(catalog.get('b').coordinates.longitude,139.8);
  } finally {refresh.destroy();catalog.destroy();}
});

test('renaming a cached endpoint updates route text while unrelated fields and travel mode do not trigger recalculation',async()=>{
  const f=fixture();await f.refresh.refresh();
  f.rows.set('a',{...f.rows.get('a'),name:'新起点名'});await f.refresh.refresh();
  assert.equal(f.calls.length,2);assert.equal(f.refresh.snapshot().selectedEndpoints.origin.label,'新起点名');
  assert.equal(f.refresh.snapshot().estimates.walking.routeSummary,'新起点名 → 终点');
  f.rows.set('a',{...f.rows.get('a'),summary:'新介绍',hidden:true});f.state.travelMode='bicycle';
  await f.refresh.refresh();await f.refresh.refresh();
  assert.equal(f.calls.length,2);assert.equal(f.state.travelMode,'bicycle');
  assert.equal(f.state.routeOrigin.id,'a','hiding a place does not cancel its navigation endpoint');
});

test('navigation anchor, region and station identity changes invalidate the actual route inputs',async()=>{
  const f=fixture();
  f.rows.set('a',{...f.rows.get('a'),coordinates:null,livingAreaRole:'small',displayAnchorCoordinates:{longitude:139.71,latitude:35.7}});
  f.service.estimateAll=({origin,destination})=>{f.calls.push(structuredClone({origin,destination}));return {origin,destination,estimates:{walking:{ok:true,minutes:10}}};};
  await f.refresh.refresh();
  f.rows.set('a',{...f.rows.get('a'),displayAnchorCoordinates:{longitude:139.73,latitude:35.7}});await f.refresh.refresh();
  f.rows.set('a',{...f.rows.get('a'),regionCode:'11'});await f.refresh.refresh();
  f.rows.set('a',{...f.rows.get('a'),type:'车站',officialRail:{sourceGroupCodes:['001']}});await f.refresh.refresh();
  assert.equal(f.calls.length,4);assert.equal(f.calls[1].origin.displayAnchorCoordinates.longitude,139.73);
});

test('an endpoint missing from the current catalog keeps its selected snapshot without discarding the other latest endpoint',async()=>{
  const f=fixture(),origin=f.state.routeOrigin;f.rows.delete('a');
  const destination=point('b','新终点',139.85);f.rows.set('b',destination);
  await f.refresh.refresh();assert.equal(f.state.routeOrigin,origin);assert.equal(f.state.routeDestination,destination);
  assert.equal(f.calls.length,1);
});

test('an older service load cannot calculate or overwrite a newer edited route',async()=>{
  const first=deferred(),second=deferred();let loads=0;
  const f=fixture({loadService:()=>++loads===1?first.promise:second.promise});
  const old=f.refresh.refresh();f.rows.set('a',point('a','起点',139.75));const latest=f.refresh.refresh();
  assert.deepEqual(f.refresh.snapshot().estimates,{});assert.equal(f.refresh.snapshot().selectedEndpoints,null);
  second.resolve(f.service);await latest;assert.equal(f.calls.length,1);
  first.resolve(f.service);await old;assert.equal(f.calls.length,1);
  assert.equal(f.refresh.snapshot().selectedEndpoints.origin.coordinates.longitude,139.75);
});

test('clearing an endpoint invalidates an outstanding estimate and retains the chosen travel mode',async()=>{
  const pending=deferred(),f=fixture({estimateAll:()=>pending.promise});
  const old=f.refresh.refresh();await Promise.resolve();
  f.state.routeDestination=null;await f.refresh.refresh();
  pending.resolve({origin:point('a','旧起点',139.7),destination:point('b','旧终点',139.8),estimates:{walking:{ok:true,minutes:99}}});
  await old;
  assert.deepEqual(f.refresh.snapshot().estimates,{});assert.equal(f.refresh.snapshot().selectedEndpoints,null);
  assert.equal(f.refresh.snapshot().status,'选择起点和终点后估算');assert.equal(f.state.travelMode,'walking');
});

test('failed requests can retry, and destroying the route view prevents late publication',async()=>{
  let fail=true;const f=fixture({loadService:()=>fail?Promise.reject(new Error('读取失败')):Promise.resolve(f.service)});
  await f.refresh.refresh();assert.equal(f.refresh.snapshot().status,'读取失败');
  fail=false;await f.refresh.refresh();assert.equal(f.calls.length,1);assert.equal(f.refresh.snapshot().status,'');
  const pending=deferred();f.service.estimateAll=()=>pending.promise;
  f.rows.set('a',point('a','起点',139.76));const old=f.refresh.refresh();await Promise.resolve();
  const count=f.changes.length;f.refresh.destroy();
  pending.resolve({origin:{},destination:{},estimates:{walking:{ok:true,minutes:999}}});await old;
  assert.equal(f.changes.length,count);
});

// Reuse the map tests' DOM boundary and canvas-stroke approach, with the live mountMap rendering path.
function mountedMapFixture() {
  const previous=globalThis.document,nodes=new Map(),strokes=[],points=[],styles={},errors=[],selections=[];
  const box=()=>({left:0,top:0,width:800,height:500});
  const context=new Proxy(styles,{set(target,key,value){target[key]=value;return true;},get(target,key){
    if(key==='clearRect')return()=>{strokes.length=0;};
    if(key==='beginPath')return()=>{points.length=0;};
    if(key==='moveTo'||key==='lineTo')return(x,y)=>points.push([x,y]);
    if(key==='setLineDash')return value=>{target.dash=value;};
    if(key==='stroke')return()=>strokes.push({dash:[...(target.dash||[])],points:points.map(p=>[...p])});
    if(key==='measureText')return text=>({width:String(text).length*8});
    return Object.hasOwn(target,key)?target[key]:()=>{};
  }});
  let document;
  const node=key=>{
    if(nodes.has(key))return nodes.get(key);
    const value={id:key,dataset:{},style:{},children:[],innerHTML:'',textContent:'',value:'',scrollLeft:0,options:[],
      classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(){},removeEventListener(){},remove(){},
      querySelector:selector=>node(selector),querySelectorAll:()=>[],getBoundingClientRect:box,getContext:()=>context,
      prepend(child){this.appendChild(child);},appendChild(child){child.parentElement=this;this.children.push(child);},
      get ownerDocument(){return document;},closest:()=>null};
    nodes.set(key,value);return value;
  };
  document={body:node('body'),querySelector:node,querySelectorAll:()=>[],createElement:tag=>node(tag+nodes.size),addEventListener(){},removeEventListener(){}};
  globalThis.document=document;
  const origin=point('a','起点',139.7),destination=point('b','终点',139.8),rows=new Map([['a',origin],['b',destination]]);
  const catalog={get:id=>rows.get(id),regions:()=>[],relatedDisplay:async()=>[],relatedDisplayRevision:()=>0,
    projection:()=>({xScale:1,yScale:1,xOffset:0,yOffset:0}),loadRegion:async()=>({map:{defaultBounds:[139,35,140,36]}}),viewport:async()=>({entities:[...rows.values()]})};
  const state={selected:origin,selectedId:origin.id,routeOrigin:origin,routeDestination:destination,travelMode:'walking',page:'map',regionCode:'13',
    mapView:{regionCode:'13',mode:'detail',center:[139.75,35.7],scale:100}};
  const ui={layout:'desktop',state,esc,engine:{data:{packages:[],places:[]}},reader:{packageIds:()=>[],close:async()=>true},
    selectEntity:entity=>selections.push(entity),notify:message=>errors.push(message),
    bridge:{catalog,session:{ensureSummaries:async()=>{}},store:{read:()=>({livingJapanTextOverrides:{records:{}}})},
      baseline:{transitTime:{load:async()=>({data:{transitTime:{stationAnchors:[],railNetwork:{lines:[],edges:[],transferLinks:[]}}}})}},fetcher:async()=>Response.json({})}};
  const map=mountMap(ui);
  return {map,state,rows,origin,destination,errors,selections,
    route:()=>strokes.find(stroke=>stroke.dash.join(',')==='6,5')?.points,
    async render(){await map.render();await new Promise(resolve=>setTimeout(resolve,30));},
    restore(){map.destroy();globalThis.document=previous;}};
}

for(const externalUpdated of [false,true])test(`map render refreshes the canvas selected endpoint when external selection is ${externalUpdated?'already updated':'still stale'}`,async()=>{
  const f=mountedMapFixture();
  try {
    await f.render();const before=f.route(),view=structuredClone(f.state.mapView);
    assert.equal(before.length,2);
    const origin={...f.origin,coordinates:{longitude:139.6,latitude:35.7}};f.rows.set(origin.id,origin);
    if(externalUpdated)f.state.selected=origin;
    await f.render();
    assert.notDeepEqual(f.route()[0],before[0],'the canvas line starts at the edited coordinate rather than the old selected snapshot');
    assert.equal(f.state.selected,origin);assert.equal(f.state.routeOrigin,origin);
    assert.deepEqual(f.route()[1],before[1]);
    const changedOrigin=f.route()[0],destination={...f.destination,coordinates:{longitude:139.9,latitude:35.7}};f.rows.set(destination.id,destination);
    await f.render();assert.deepEqual(f.route()[0],changedOrigin);assert.notDeepEqual(f.route()[1],before[1]);
    assert.equal(f.state.selected,origin,'editing the other endpoint preserves the current selection');
    assert.deepEqual(f.state.mapView.center,view.center);assert.equal(f.state.mapView.scale,view.scale);assert.equal(f.state.mapView.mode,view.mode);
    assert.equal(f.state.travelMode,'walking');assert.deepEqual(f.selections,[]);assert.deepEqual(f.errors,[]);
  } finally {f.restore();}
});

