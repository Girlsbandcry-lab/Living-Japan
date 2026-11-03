import test from 'node:test';
import assert from 'node:assert/strict';
import { createBaselineEngine } from '../src/baseline.js';
import { placeAdministrativeIdentity } from '../src/place-admin-context.js';
import { emptyMaterialRuntime } from './helpers/material-runtime.mjs';

const admins=[
  {id:'jp',name:'日本',kind:'country',parentId:null},
  {id:'pref:14',name:'神奈川县',nameJa:'神奈川県',kind:'prefecture',parentId:'jp',regionCode:'14'},
  {id:'city:yokohama',name:'横滨市',nameJa:'横浜市',kind:'city',parentId:'pref:14',regionCode:'14'},
  {id:'ward:yokohama:south',name:'南区',kind:'ward',parentId:'city:yokohama',regionCode:'14'},
  {id:'ward:yokohama:middle',name:'中区',kind:'ward',parentId:'city:yokohama',regionCode:'14'},
  {id:'pref:11',name:'埼玉县',nameJa:'埼玉県',kind:'prefecture',parentId:'jp',regionCode:'11'},
  {id:'city:saitama',name:'埼玉市',nameJa:'さいたま市',kind:'city',parentId:'pref:11',regionCode:'11'},
  {id:'ward:saitama:south',name:'南区',kind:'ward',parentId:'city:saitama',regionCode:'11'},
];
const place=(id,name,adminNodeId)=>({id,name,fullNames:[name],kind:'poi',canonicalPlace:true,adminNodeId});
const book=place('book:yokohama','光书店','ward:yokohama:south');
const otherBook=place('book:saitama','光书店','ward:saitama:south');
const cafe=place('cafe','海咖啡','ward:yokohama:middle');
const user=text=>({role:'user',mes:text}),assistant=text=>({role:'assistant',mes:text});
function fixture(rows=[book,otherBook,cafe],extra={}) {
  const data=emptyMaterialRuntime();data.adminNodes=structuredClone(admins);
  data.canonicalPlaceContexts={adminNodes:Object.fromEntries(admins.map(node=>[node.id,node])),aliases:{},rows:Object.fromEntries(rows.map(row=>[row.id,row]))};
  Object.assign(data,extra);
  const engine=createBaselineEngine(data);
  const match=(messages,settings={})=>engine.resolveCanonicalPlaceMatchDetailed(engine.collectChannelEntries(messages,'EX',8,'normal',settings),rows);
  return {engine,data,match};
}

test('administrative identity uses current personal fields and accepts a valid adminPath leaf',()=>{
  const {data}=fixture();
  const result=placeAdministrativeIdentity(book,data);
  assert.equal(result.id,'ward:yokohama:south');assert.equal(result.label,'神奈川县 横滨市 南区');
  assert.equal(placeAdministrativeIdentity({...book,adminNodeId:null,adminPath:['jp','pref:14','city:yokohama','ward:yokohama:south']},data).id,result.id);
  data.placeEdits={created:{},overrides:{[book.id]:{adminNodeId:'ward:yokohama:middle',adminPath:['jp','pref:14','city:yokohama','ward:yokohama:middle']}}};
  assert.equal(placeAdministrativeIdentity(book,data).id,'ward:yokohama:middle');
  assert.equal(placeAdministrativeIdentity({id:'unassigned',name:'自建店'},data),null);
  data.placeEdits.overrides[book.id]={adminNodeId:null,adminPath:[]};
  assert.equal(placeAdministrativeIdentity({...book,administrativeNodeId:book.adminNodeId},data),null,'an explicit cleared assignment must not revive a legacy field');
  const partial={adminNodes:[{id:'pref',name:'测试县',kind:'prefecture'},{id:'city',name:'同名市',kind:'city'},
    {id:'duplicate',name:'同名市',kind:'city'},{id:'ward',name:'北区',kind:'ward'}]};
  assert.equal(placeAdministrativeIdentity({id:'partial',adminPath:['pref','city','duplicate','ward']},partial).label,'测试县 同名市 北区');
});

test('a named place requires its own administrative area and rejects an unqualified shared ward name',()=>{
  const f=fixture();
  assert.deepEqual(f.match([user('进入光书店。')]).directPlaceIds,[]);
  assert.deepEqual(f.match([user('南区 光书店。')]).directPlaceIds,[]);
  assert.deepEqual(f.match([user('横滨市 光书店。')]).directPlaceIds,[],'the parent city alone does not stand for all its wards');
  assert.deepEqual(f.match([user('横滨市南区 光书店。')]).directPlaceIds,[book.id]);
  assert.deepEqual(f.match([user('埼玉市南区 光书店。')]).directPlaceIds,[otherBook.id]);
  const regional=fixture([{...book,regionId:'YOKOHAMA'},{...otherBook,regionId:'SAITAMA'}],{
    regionMarkers:[{regionId:'YOKOHAMA',triggers:['横滨市']},{regionId:'SAITAMA',triggers:['埼玉市']}],
  });
  assert.deepEqual(regional.match([user('横滨市南区 光书店，地点改为埼玉市南区。')]).directPlaceIds,[otherBook.id]);
});

test('recent administrative context is inherited but an explicit new ward blocks an older scene',()=>{
  const f=fixture();
  assert.deepEqual(f.match([assistant('横滨市南区。'),user('进入光书店。')]).directPlaceIds,[book.id]);
  assert.deepEqual(f.match([assistant('横滨市。'),user('南区 光书店。')]).directPlaceIds,[book.id]);
  assert.deepEqual(f.match([assistant('横滨市南区 光书店。'),user('已经到了横滨市中区。')]).directPlaceIds,[]);
  assert.deepEqual(f.match([assistant('横滨市南区 光书店。'),user('横滨市中区 光书店。')]).directPlaceIds,[]);
});

test('traffic pairs each name locally and the destination stays the latest valid place',()=>{
  const f=fixture();
  assert.deepEqual(f.match([user('从 神奈川县 横滨市 南区 光书店处出发，步行，至 神奈川县 横滨市 中区 海咖啡（目的地）。')]).directPlaceIds,[cafe.id]);
});

test('same-area same-name candidates remain ambiguous instead of depending on input order',()=>{
  const twin=place('book:twin','光书店',book.adminNodeId);
  for(const rows of [[book,twin],[twin,book]])assert.deepEqual(fixture(rows).match([user('横滨市南区 光书店。')]).directPlaceIds,[]);
});

test('administrative words inside a place name neither satisfy pairing nor become inherited context',()=>{
  const inside=place('inside','南区光书店',book.adminNodeId),f=fixture([inside,book,cafe]);
  assert.deepEqual(f.match([user('横滨市中区 南区光书店。')]).directPlaceIds,[]);
  assert.deepEqual(f.match([assistant('横滨市中区 南区光书店。'),user('去光书店。')]).directPlaceIds,[]);
  assert.deepEqual(f.match([user('横滨市南区 南区光书店。')]).directPlaceIds,[inside.id]);
});

test('registered composite branches are resolved together before same-area ambiguity is decided',()=>{
  const first={...place('north','北门茶房',book.adminNodeId),locationComposite:{cores:['茶房'],qualifiers:['北门']}};
  const second={...place('second','二号茶房',book.adminNodeId),locationComposite:{cores:['茶房'],qualifiers:['北门']}};
  assert.deepEqual(fixture([first,second]).match([user('横滨市南区 北门的茶房。')]).directPlaceIds,[]);
  const south={...second,locationComposite:{cores:['茶房'],qualifiers:['南门']}};
  assert.deepEqual(fixture([south,first]).match([user('横滨市南区 北门的茶房。')]).directPlaceIds,[first.id]);
});

test('the latest place mention owns its span before administrative checking and never falls back to an earlier place',()=>{
  const long=place('long','大松咖啡馆',book.adminNodeId),short=place('short','咖啡馆',cafe.adminNodeId),f=fixture([long,short,cafe]);
  assert.deepEqual(f.match([user('横滨市中区 海咖啡，然后大松咖啡馆。')]).directPlaceIds,[]);
  assert.deepEqual(f.match([user('横滨市中区 大松咖啡馆，然后去咖啡馆。')]).directPlaceIds,[short.id]);
});

test('a complete branch location can supply its own later area, while an explicit area after it wins in turn',()=>{
  const branch=place('flower','花店南区分店',book.adminNodeId),f=fixture([branch,cafe]);
  assert.deepEqual(f.match([user('横滨市中区 花店南区分店。')]).directPlaceIds,[branch.id]);
  assert.deepEqual(f.match([user('横滨市 花店南区分店，地点改为中区。')]).directPlaceIds,[]);
  assert.deepEqual(f.match([user('花店南区分店。')]).directPlaceIds,[],'an ambiguous ward name still needs a parent administrative context');
});

test('an administrative name registered as another place alias does not hide the independent area prefix',()=>{
  const alias={...place('alias','南区纪念馆',book.adminNodeId),aliasTriggers:['南区']};
  assert.deepEqual(fixture([book,otherBook,alias]).match([user('横滨市南区 光书店。')]).directPlaceIds,[book.id]);
});

test('a later complete registered composite is compared with an earlier full name in the same segment',()=>{
  const tea={...place('tea','北门茶房',book.adminNodeId),locationComposite:{cores:['茶房'],qualifiers:['北门']}};
  const f=fixture([book,tea]);
  assert.deepEqual(f.match([user('横滨市南区 先光书店，后来北门的茶房。')]).directPlaceIds,[tea.id]);
  assert.deepEqual(f.match([user('横滨市南区 先北门的茶房，后来光书店。')]).directPlaceIds,[book.id]);
});
