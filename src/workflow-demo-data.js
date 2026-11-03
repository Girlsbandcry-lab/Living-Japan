import { createBaselineEngine } from './baseline.js';
import { createUserStore } from './storage.js';
import { materialOwnFragmentId, materialPackageId } from './material-library.js';
import { placeEditPackageId } from './place-edits.js';
import { canonicalAliasBucket } from './canonical-places.js';
import { METRO_POINT_CATEGORIES } from './metro-point-categories.js';

export const DEMO_IDS = Object.freeze({ cafe:'user-place:demo-cafe', peer:'user-place:demo-peer', court:'user-place:demo-court', hall:'user-place:demo-hall', city:'admin:demo-city', wood:'demo.wood', rain:'demo.rain' });
export const DEMO_CHAT = '四月上旬，15:30，小雨。示例县示例市，木窗咖啡店。';
const clone = value => structuredClone(value);
export function createWorkflowData({ wrappers, defaultSettings = {}, layout = 'desktop' } = {}) {
  if (!wrappers?.background) throw new Error('演示缺少当前程序的提示词档位');
  const adminNodes = [
    {id:'admin:jp',name:'日本',label:'日本',kind:'country',parentId:null,adminPath:[]},
    {id:'admin:demo-pref',name:'示例县',label:'示例县',kind:'prefecture',parentId:'admin:jp',adminPath:['admin:jp'],regionCode:'13'},
    {id:DEMO_IDS.city,name:'示例市',label:'示例市',kind:'city',parentId:'admin:demo-pref',adminPath:['admin:jp','admin:demo-pref'],regionCode:'13'},
  ];
  const administrativePath = adminNodes.map(row => row.id);
  const types=new Map(METRO_POINT_CATEGORIES.map(row=>[row.id,row]));
  const point = (key,name,typeId,longitude,latitude,parentId,summary) => {
    const type=types.get(typeId);if(!type)throw new Error('示例地点类型不存在：'+typeId);
    const typePathIds=[];for(let row=type;row;row=types.get(row.parentId))typePathIds.unshift(row.id);typePathIds.unshift('layer:'+type.layer);
    return {id:DEMO_IDS[key],name,fullNames:[name],aliases:[],type:type.label,typeId,typePathIds,kind:'content_object',sourceIds:[DEMO_IDS[key]],canonicalPlace:true,regionCode:'13',adminNodeId:DEMO_IDS.city,adminPath:administrativePath,adminNodes:clone(adminNodes),coordinates:{longitude,latitude},parentId,summary,related:parentId&&!parentId.startsWith('admin:')?[{id:parentId,kind:'within'}]:[]};
  };
  const rows = [
    point('hall','庭院会馆','in.culture.cultural-hall',139.7000,35.6900,DEMO_IDS.court,'庭院内的两层建筑，临街一侧有咖啡店。'),
    point('cafe','木窗咖啡店','in.food.cafe',139.7002,35.6901,DEMO_IDS.hall,'木窗旁设长桌，入口连着庭院。'),
    point('court','林荫庭院','ex.open-space.garden',139.7050,35.6920,DEMO_IDS.city,'石板小径穿过树荫，入口设长椅。'),
    point('peer','石阶咖啡角','in.food.cafe',139.7003,35.6902,DEMO_IDS.hall,'石阶旁的小咖啡馆，门前放着两张圆桌。'),
  ];
  rows[0].related.push({id:DEMO_IDS.cafe,kind:'contains'},{id:DEMO_IDS.peer,kind:'contains'});
  rows[2].related.push({id:DEMO_IDS.hall,kind:'contains'});
  const settings = {schemaVersion:4,masterEnabled:true,namedPlaceBodiesEnabled:true,wrapperMode:'background',diagnostics:true,historyDepth:4,textScript:'simplified',layers:{TN:true,EX:true,IN:true,EV:true},groups:{},packages:{},currentUserBoundary:{start:'',end:''},channelTags:Object.fromEntries(['TN','EX','IN','EV'].map(id=>[id,{priority:[],excluded:[]}]))};
  const runtime = {productId:'living-japan',releaseId:'workflow-example',version:'演示',schemaVersion:4,settingsKey:'livingJapanSettings',textOverrideKey:'livingJapanTextOverrides',textOverrideFormat:'living-japan-text-overrides',uiPreferencesKey:'livingJapanUIPreferences',macroName:'livingjapan',outputTag:'background_element',layerOrder:['TN','EX','IN','EV'],wrappers:clone(wrappers),defaultSettings:settings,defaultUIPreferences:{schemaVersion:4,panelPinned:true,uiThemePreference:'day',panelLayoutMode:layout==='desktop'?'horizontal':'vertical',transitFavoritePlaces:[]},packages:[],places:[],adminNodes:clone(adminNodes),controlGroups:[],bodyRecords:[],calendarSegments:[],runtimeContextAnchors:[],walkingInterests:[],textConversion:{},groupLabels:{},regionMarkers:[],locationTimeFocus:{records:[],reviewedCandidatePackageIds:[]},editableTextSlots:{schemaVersion:1,slots:{},staticCount:0,calendarCount:0,slotCount:0},runtimeTextManifest:{schemaVersion:1,bodies:{},summaries:{},contextsPath:'data/national/contexts.json'},locationBrowse:{schemaVersion:1,regions:[],areas:[],objects:[]}};
  const created = Object.fromEntries(rows.map(row=>[row.id,Object.fromEntries(['name','fullNames','type','typeId','parentId','adminNodeId','adminPath','adminNodes','regionCode','coordinates','summary'].map(key=>[key,clone(row[key])]))]));
  const user = {livingJapanSettings:clone(settings),extensionUi:{layout,pinned:true,theme:'day',guide:{completed:true,autoPrompt:false}},placeEdits:{schemaVersion:1,created,overrides:{}},materialLibrary:{categories:{
    [DEMO_IDS.wood]:{id:DEMO_IDS.wood,name:'木窗与长桌',parentId:null,layer:'IN'},
    [DEMO_IDS.rain]:{id:DEMO_IDS.rain,name:'雨天檐下',parentId:null,layer:'EX'},
  },regions:{},fragments:{},places:Object.fromEntries(rows.map(row=>[row.id,clone(row)])),bindings:{wood:{id:'wood',entityId:DEMO_IDS.cafe,categoryId:DEMO_IDS.wood,enabled:true}}},livingJapanTextOverrides:{schemaVersion:1,records:{},orphans:{}}};
  const engine = createBaselineEngine(runtime,user);
  const put = (id,body) => {const variant=engine.editableVariantsForPackage(id)[0];if(!variant)throw new Error('示例正文缺少保存位置：'+id);user.livingJapanTextOverrides.records[variant.slotKey]=engine.createOverrideRecord(variant,body);};
  put(placeEditPackageId(DEMO_IDS.cafe),'木窗咖啡店开在庭院会馆临街的一侧。入口旁是窄柜台，靠窗长桌面向庭院，后排座位隔着矮木架。');
  put(placeEditPackageId(DEMO_IDS.hall),'庭院会馆由两层建筑和前方庭院组成，外廊连接正门与临街店铺。');
  put(placeEditPackageId(DEMO_IDS.court),'林荫庭院的石板小径绕过草地，树下长椅面向中央空地。');
  put(materialPackageId(materialOwnFragmentId(DEMO_IDS.wood)),'木窗和长桌构成靠窗一侧的连续座位，桌面与窗框保留木纹。');
  put(materialPackageId(materialOwnFragmentId(DEMO_IDS.rain)),'下小雨时，雨水顺檐口落到石板边缘，檐下留出一条可停留的窄带。');
  const bounds=[-15,-15,30,25], projection={xScale:1000,xOffset:-139700,yScale:-1000,yOffset:35690};
  const paths={detail:'demo-detail.json',light:'demo-light.json',geo:'demo-geo.json'};
  const part={path:paths.detail,count:rows.length,bounds,regionCodes:['13'],adminNodeIds:[DEMO_IDS.city]};
  const aliases={};for(const row of rows){const b=canonicalAliasBucket(row.id);(aliases[b]||={})[row.id]={id:row.id,path:paths.detail,regionCode:'13'};}
  const region={code:'13',name:'示例县',mapPath:'demo-map.json',bounds};
  const index={packageMode:true,activeRegionCodes:['13'],runtimeSource:{kind:'overture'},adminNodes:clone(adminNodes),projection,navigationRegions:[{id:'navigation:demo',name:'演示地区',regionCodes:['13']}],regions:[region],views:[{code:'metro',name:'演示地区',regionCodes:['13'],mapPath:'demo-map.json',bounds},{code:'00',name:'演示全图',regionCodes:['13'],mapPath:'demo-map.json',bounds}],canonicalPlaces:{version:1,categories:[],parts:[part],aliasParts:Object.keys(aliases).map(bucket=>({bucket:Number(bucket),path:`demo-alias-${bucket}.json`})),catalogIndex:{parts:[{...part,path:paths.light,detailPath:paths.detail}],adminParts:[]},geographicIndex:{version:1,parts:[{path:paths.geo,regionCodes:['13'],adminCounts:{[DEMO_IDS.city]:2}}]}}};
  const transitTime={stationAnchors:[],areaAnchors:[],railNetwork:{lines:[],edges:[],transferLinks:[]},roadGrid:{grid:{origin:[139.6,35.6],cellDegrees:0.2,bounds:[139.6,35.6,139.8,35.8]},cells:[{id:'grid_00_00',column:0,row:0,bounds:[139.6,35.6,139.8,35.8]}],pairs:[{fromCellId:'grid_00_00',toCellId:'grid_00_00',endpointDetourFactor:1.2}]},model:{}};
  const files={'data/runtime/runtime.json':runtime,'data/national/manifest.json':index,'data/national/contexts.json':{rows},'data/national/demo-detail.json':{rows},'data/national/demo-light.json':{rows},'data/national/demo-geo.json':{nodes:rows.map((row,i)=>({id:row.id,name:row.name,regionCode:'13',adminNodeId:DEMO_IDS.city,ref:{path:paths.light,index:i},parents:row.parentId&&!row.parentId.startsWith('admin:')?[{id:row.parentId,regionCode:'13'}]:[]}))},'data/national/demo-map.json':{region:{defaultBounds:bounds},geo:{bounds,land:[{n:'演示街区',b:[-1800,-1800,1800,1800],d:'M-1800 -1800L1800 -1800L1800 1800L-1800 1800Z'}],rivers:[],parkPolys:[{n:'林荫庭院',d:'M-45 -38L65 -38L65 40L-45 40Z',x:10,y:-22,a:8580}],labels:[{n:'示例街区 · 简图',x:-95,y:-65}]},poi:{cats:'',list:[]},transport:{stations:[],railways:[]}},'data/national/land-overview.json.gz':{land:[]},'src/legacy/transit-data.json':{transitTime,transitMap:{}},'data/metro-transit.json':{stations:[],lines:[],edges:[]}};
  for(const [bucket,value] of Object.entries(aliases))files[`data/national/demo-alias-${bucket}.json`]={aliases:value};
  const requests=[];
  const fetcher=async url=>{const pathname=new URL(url,'https://workflow.invalid/').pathname;const key=Object.keys(files).find(name=>pathname.endsWith('/'+name));requests.push(key||pathname);return key?Response.json(clone(files[key])):new Response('演示未登记此资料',{status:404});};
  return {runtime,user,index,rows,files,fetcher,requests};
}
export async function createWorkflowStore(initial) {
  let memory=clone(initial);const store=createUserStore({transport:{read:async()=>clone(memory),write:async value=>{memory=clone(value);}}});await store.load();return store;
}
