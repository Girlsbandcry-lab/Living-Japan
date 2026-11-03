import { $, esc } from './dom.js';
import { PLACE_EDIT_TYPES } from '../src/place-edits.js';
import { createPlaceMaterialsPanel, commitPendingMaterials } from './place-materials.js';

// LJ-BINDING-TYPE-GROUP-20261102: display-only partition; selections and macro rules keep their existing identities.
export { groupPlaceBindingCategories } from './place-materials.js';

const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
export function createPlaceDraft(snapshot) {
  return { snapshot:copy(snapshot), id:snapshot.id, isNew:snapshot.isNew, values:copy(snapshot.values), bodies:Object.fromEntries(snapshot.bodyVariants.map(v=>[v.slotKey,v.body||''])), bindings:copy(snapshot.bindings||[]), restoreFields:[], restoreBodies:[], restoreAll:false, tab:'data', bodyKey:snapshot.bodyVariants[0]?.slotKey||'', active:true };
}
export function restorePlaceDraftField(draft,field) {
  draft.values[field]=copy(draft.snapshot.builtin?.[field]??(Array.isArray(draft.values[field])?[]:null));
  if(!draft.restoreFields.includes(field))draft.restoreFields.push(field);
}
export function restorePlaceDraftAll(draft) {
  for(const field of Object.keys(draft.values))if(Object.hasOwn(draft.snapshot.builtin||{},field))restorePlaceDraftField(draft,field);
  for(const variant of draft.snapshot.bodyVariants)if(!variant.userSlot){draft.bodies[variant.slotKey]=variant.builtinBody||'';if(!draft.restoreBodies.includes(variant.slotKey))draft.restoreBodies.push(variant.slotKey);}
  draft.bindings=copy(draft.snapshot.builtin?.bindings||[]);
  draft.restoreAll=true;
}
export function placeDraftPayload(draft) {
  const restored=draft.restoreFields.filter(field=>equal(field==='bindings'?draft.bindings:draft.values[field],draft.snapshot.builtin?.[field]??(field==='bindings'||Array.isArray(draft.values[field])?[]:null)));
  const fields=Object.fromEntries(Object.entries(draft.values).filter(([field,value])=>draft.isNew||!restored.includes(field)&&(!equal(value,draft.snapshot.values[field])||draft.restoreAll&&!equal(value,draft.snapshot.builtin?.[field]))));
  const restoreBodies=draft.restoreBodies.filter(key=>draft.bodies[key]===(draft.snapshot.bodyVariants.find(v=>v.slotKey===key)?.builtinBody||''));
  const bodies=Object.fromEntries(Object.entries(draft.bodies).filter(([key,value])=>{const variant=draft.snapshot.bodyVariants.find(v=>v.slotKey===key);return !restoreBodies.includes(key)&&(value!==(variant?.body||'')||draft.restoreAll&&!variant?.userSlot&&value!==(variant?.builtinBody||''));}));
  const bindingsChanged=!restored.includes('bindings')&&(!equal(draft.bindings,draft.snapshot.bindings||[])||draft.restoreAll&&!equal(draft.bindings,draft.snapshot.builtin?.bindings||[]));
  return {isNew:draft.isNew,fields,bodies,...(bindingsChanged?{bindings:copy(draft.bindings)}:{}),restoreFields:restored,restoreBodies,restoreAll:draft.restoreAll};
}

// LJ-PLACE-EDITOR-20261102: shared drafts own all fields, text and map-pick confirmation until one save.
export function createPlaceEditor(ui) {
  if(!$('#ljPlaceEditorStyle')){const link=document.createElement('link');link.id='ljPlaceEditorStyle';link.rel='stylesheet';link.href=new URL('./place-editor.css',import.meta.url).href;document.head.append(link);}
  let host=null,busy=false,parentResults=[];
  const current=()=>ui.state.placeEditor;
  const runtime=()=>ui.bridge.session.runtime;
  const materials=createPlaceMaterialsPanel(ui,{render,getHost:()=>host,changed:()=>updateFieldState('bindings')});
  function suspend(){materials.capture(host);host?.remove();host=null;document.body.classList.remove('lj-place-editing');}
  // LJ-PLACE-CANCEL-20261102: cancel shares the leave check; new-place defaults alone are not unsaved work.
  function dirty(){
    const d=current();if(!d)return false;if(d.materials?.pending?.length)return true;
    if(d.isNew)return !equal(d.values,d.snapshot.values)||!equal(d.bindings,d.snapshot.bindings||[])||!equal(d.bodies,Object.fromEntries(d.snapshot.bodyVariants.map(v=>[v.slotKey,v.body||''])));
    const p=placeDraftPayload(d);return Boolean(p.restoreAll||p.restoreFields.length||p.restoreBodies.length||Object.keys(p.fields).length||Object.keys(p.bodies).length||p.bindings);
  }
  async function requestLeave(){
    if(busy)return false;if(!current())return true;
    if(!dirty()){suspend();delete ui.state.placeEditor;return true;}
    const pending=current().materials?.pending?.length||0;
    const answer=await ui.ask({title:'地点资料尚未保存',message:`关闭前保存，或放弃本次草稿。${pending?`包含待选的 ${pending} 个词条，保存时会一并添加。`:''}`,choices:[{id:'cancel',label:'继续编辑'},{id:'discard',label:'放弃草稿'},{id:'save',label:'保存并关闭',primary:true}]});
    if(answer==='save')return save();if(answer==='discard'){suspend();delete ui.state.placeEditor;return true;}return false;
  }
  async function open(entity=null,options={}){
    const d=current();if(d&&d.id===entity?.id){d.active=true;d.tab=options.tab||d.tab;await ui.showPage('region');render();return;}
    if(d&&!(await requestLeave()))return;
    if(!(await ui.reader.close()))return;
    const snapshot=await runtime().readPlaceEdit(entity,options);
    ui.state.placeEditor=createPlaceDraft(snapshot);current().tab=options.tab||'data';if(snapshot.bodyVariants.some(v=>v.slotKey===options.bodyKey))current().bodyKey=options.bodyKey;
    if(snapshot.values.parentId){const parent=await ui.bridge.catalog.browseNode(snapshot.values.parentId);current().parentLabel=parent?.name||parent?.label||'';}
    await ui.showPage('region');render();
  }
  async function save(){
    const d=current();if(!d||busy)return false;const savingDraft=copy(d);commitPendingMaterials(savingDraft);busy=true;render();
    try{const saved=await runtime().savePlaceEdit(d.id,placeDraftPayload(savingDraft));suspend();delete ui.state.placeEditor;await ui.refresh();await ui.locateSavedPlace(saved.id||d.id);ui.notify(d.isNew?'自建地点已保存':'地点资料已保存');return true;}
    catch(error){ui.notify(error.message,'error');return false;}finally{busy=false;if(current())render();}
  }
  const permission=field=>field==='summary'||field==='body'||(field==='coordinates'?current().snapshot.permissions.coordinates:current().snapshot.permissions.structure);
  function fieldState(field){
    const d=current(),value=field==='bindings'?d.bindings:d.values[field],builtin=d.snapshot.builtin?.[field];
    const restored=d.restoreFields.includes(field)&&equal(value,builtin??(field==='bindings'?[]:null));
    const changed=d.snapshot.overriddenFields.includes(field)||!equal(value,field==='bindings'?d.snapshot.bindings:d.snapshot.values[field])||field==='type'&&(d.snapshot.overriddenFields.includes('typeId')||!equal(d.values.typeId,d.snapshot.values.typeId));
    return {restored,changed};
  }
  function restoreButton(field){const d=current();if(d.isNew||d.snapshot.permissions.coordinates||!permission(field))return'';const {restored,changed}=fieldState(field);return `<span class="lj-place-field-state" data-place-state="${field}" ${restored||changed?'':'hidden'}><small>${restored?'已恢复，待保存':'已修改'}</small><button type="button" data-place-edit="restore-field" data-field="${field}" ${restored?'hidden':''} ${busy?'disabled':''}>恢复内置</button></span>`;}
  function updateFieldState(field){const group=host?.querySelector(`[data-place-state="${field}"]`);if(!group)return;const {restored,changed}=fieldState(field);group.hidden=!restored&&!changed;group.querySelector('small').textContent=restored?'已恢复，待保存':'已修改';group.querySelector('button').hidden=restored;}
  function bodyRestoreControl(variant){const d=current();if(d.isNew||d.snapshot.permissions.coordinates||!variant||variant.userSlot)return'';const restored=d.restoreBodies.includes(variant.slotKey)&&d.bodies[variant.slotKey]===variant.builtinBody,changed=variant.custom||d.bodies[variant.slotKey]!==variant.body;return `<span class="lj-place-field-state" data-place-body-state ${restored||changed?'':'hidden'}><small>${restored?'已恢复，待保存':'已修改'}</small><button type="button" data-place-edit="restore-body" ${restored?'hidden':''}>恢复内置</button></span>`;}
  function updateBodyState(){const group=host?.querySelector('[data-place-body-state]'),d=current(),variant=d.snapshot.bodyVariants.find(v=>v.slotKey===d.bodyKey);if(!group||!variant)return;const restored=d.restoreBodies.includes(variant.slotKey)&&d.bodies[variant.slotKey]===variant.builtinBody,changed=variant.custom||d.bodies[variant.slotKey]!==variant.body;group.hidden=!restored&&!changed;group.querySelector('small').textContent=restored?'已恢复，待保存':'已修改';group.querySelector('button').hidden=restored;}
  function field(field,label,value,{multiline=false,readonly=false,extra=''}={}){
    const disabled=readonly||!permission(field),id='lj-place-'+field;
    return `<div class="lj-place-field"><div class="lj-place-label"><label for="${id}">${label}</label>${restoreButton(field)}</div>${multiline?`<textarea id="${id}" data-place-field="${field}" rows="3" ${disabled?'disabled':''}>${esc(value)}</textarea>`:`<input id="${id}" data-place-field="${field}" value="${esc(value)}" ${disabled?'disabled':''} ${extra}>`}</div>`;
  }
  async function findParents(query){
    if(!query.trim()){parentResults=[];render();return;}
    const result=await ui.bridge.catalog.search(query,{regionCode:current().values.regionCode||ui.state.regionCode,limit:20});
    parentResults=(Array.isArray(result)?result:result?.items||[]).map(item=>item.entity||item).filter(e=>e.id!==current()?.id);render();
  }
  function render(){
    const d=current();suspend();if(!d?.active||d.picker||ui.state.page!=='region')return;
    host=document.createElement('section');host.className='lj-place-editor';host.setAttribute('aria-label',d.isNew?'新增地点':'编辑地点资料');
    const desktop=ui.layout==='desktop',v=d.values,locked=!d.snapshot.permissions.structure;
    // LJ-PLACE-TYPE-CURRENT-20261102: coarse map categories never replace the current type label in the editor.
    const renderedType={type:v.type,typeId:v.typeId};
    const selectedTypeId=PLACE_EDIT_TYPES.find(row=>row.id===v.typeId&&(row.label||row.name)===v.type)?.id||'';
    if(desktop){const dock=$('#loc10DetailBody');if(!dock)return;dock.append(host);}else{$('#device').append(host);document.body.classList.add('lj-place-editing');}
    const variants=d.snapshot.bodyVariants;
    const parentName=v.parentId?(ui.bridge.catalog.get(v.parentId)?.name||d.parentLabel||'已选上级'):'无上级';
    let content='',materialView=null;
    if(d.tab==='data'){
      const coordinates=Number.isFinite(v.coordinates?.longitude)&&Number.isFinite(v.coordinates?.latitude)?`${v.coordinates.longitude.toFixed(6)}，${v.coordinates.latitude.toFixed(6)}`:'尚未设置';
      content=`${locked?'<p class="lj-place-note">内置电车站的身份与交通结构保持内置；正文和一句话介绍可以编辑。</p>':''}${field('name','地点名称',v.name)}<div class="lj-place-field"><div class="lj-place-label"><label for="lj-place-type">主要类型（单选）</label>${restoreButton('type')}</div><select id="lj-place-type" data-place-type ${locked?'disabled':''}><option value="" ${selectedTypeId?'':'selected'}>${esc(v.type||'具名地点')}（当前）</option>${[...new Map(PLACE_EDIT_TYPES.map(row=>[row.id,row])).values()].map(c=>`<option value="${esc(c.id)}" ${selectedTypeId===c.id?'selected':''}>${esc(c.label||c.name)}</option>`).join('')}</select><p class="lj-place-note">用于地点分类、地图显示与同级介绍。</p></div>${field('fullNames','完整激活词（每行一个）',(v.fullNames||[]).join('\n'),{multiline:true})}<div class="lj-place-field"><div class="lj-place-label"><label for="lj-place-parent-query">直接上级</label>${restoreButton('parentId')}</div><div class="lj-place-selected">${esc(parentName)}${!locked?'<button type="button" data-place-edit="parent-clear">清空</button>':''}</div>${locked?'':`<div class="lj-place-inline"><input id="lj-place-parent-query" placeholder="搜索地区或地点" data-place-parent-query value="${esc(d.parentQuery||'')}"><button type="button" data-place-edit="parent-search">查找</button></div><div class="lj-place-options">${parentResults.map(e=>`<button type="button" data-place-edit="parent" data-id="${esc(e.id)}">${esc(e.name||e.label)}<small>${esc(e.type||'')}</small></button>`).join('')}</div>`}</div><div class="lj-place-field"><div class="lj-place-label"><label>地图位置</label>${restoreButton('coordinates')}</div><div class="lj-place-inline"><span>${esc(coordinates)}</span>${d.snapshot.permissions.coordinates?'<button type="button" data-place-edit="pick">去全地图选点</button>':'<span class="lj-place-note">内置坐标锁定</span>'}</div></div>`;
    }else if(d.tab==='bindings'){
      materialView=materials.markup(d,locked,restoreButton('bindings'));content=materialView.content;
    }else{
      const variant=variants.find(row=>row.slotKey===d.bodyKey)||variants[0];
      content=`${field('summary','一句话介绍',v.summary||'',{multiline:true})}<div class="lj-place-field lj-place-body"><div class="lj-place-label"><label for="lj-place-body">地点正文</label>${bodyRestoreControl(variant)}</div>${variants.length>1?`<select data-place-body-select aria-label="选择正文">${variants.map(row=>`<option value="${esc(row.slotKey)}" ${row.slotKey===d.bodyKey?'selected':''}>${esc(row.title||'正文')}</option>`).join('')}</select>`:''}${variant?`<textarea id="lj-place-body" data-place-body="${esc(variant.slotKey)}" spellcheck="false">${esc(d.bodies[variant.slotKey]||'')}</textarea>`:'<p>此地点暂无正文空位</p>'}</div>`;
    }
    const defaultHeader=`<strong>${d.isNew?'新增地点':'编辑地点资料'}</strong>${!d.isNew&&!d.snapshot.permissions.coordinates?'<button type="button" data-place-edit="restore-all">整体恢复内置</button>':''}`;
    const tabs=`<nav aria-label="地点编辑分页"><button type="button" data-place-edit="tab" data-tab="data" aria-pressed="${d.tab==='data'}">地点资料</button><button type="button" data-place-edit="tab" data-tab="bindings" aria-pressed="${d.tab==='bindings'}">附加资料</button><button type="button" data-place-edit="tab" data-tab="text" aria-pressed="${d.tab==='text'}">正文与介绍</button></nav>`;
    const defaultFooter=`<span role="status">${busy?'正在保存…':'更改将在保存后生效'}</span><button type="button" data-place-edit="cancel">取消</button><button type="button" class="primary" data-place-edit="save">保存</button>`;
    host.innerHTML=`<header>${materialView?.header||defaultHeader}</header>${materialView?.immersive?'':tabs}<div class="lj-place-content">${content}</div><footer>${materialView?.footer||defaultFooter}</footer>`;
    if(materialView)materials.restore(host);
    if(busy)host.querySelectorAll('input,textarea,select,button').forEach(n=>n.disabled=true);
    host.addEventListener('input',event=>{const n=event.target;if(n.dataset.placeField){const key=n.dataset.placeField;d.values[key]=key==='fullNames'?n.value.split(/\n/).map(v=>v.trim()).filter(Boolean):n.value;updateFieldState(key);}if(n.dataset.placeBody){d.bodies[n.dataset.placeBody]=n.value;updateBodyState();}if(n.hasAttribute('data-place-parent-query'))d.parentQuery=n.value;materials.input(event,host);});
    host.addEventListener('change',event=>{const n=event.target;if(n.hasAttribute('data-place-type')){const type=PLACE_EDIT_TYPES.find(row=>row.id===n.value);if(type){d.values.typeId=type.id;d.values.type=type.label||type.name;}else if(!n.value){d.values.typeId=renderedType.typeId;d.values.type=renderedType.type;}updateFieldState('type');}if(n.hasAttribute('data-place-body-select')){d.bodyKey=n.value;render();}void materials.change(event).catch(error=>ui.notify(error.message,'error'));});
    host.addEventListener('compositionend',event=>{materials.input(event,host);});
    host.addEventListener('click',event=>{const n=event.target.closest('[data-place-edit],[data-pm-action]');if(!n||busy)return;event.stopPropagation();void (n.dataset.pmAction?materials.action(n):action(n)).catch(error=>ui.notify(error.message,'error'));});
  }
  async function action(n){const d=current(),cmd=n.dataset.placeEdit;
    if(cmd==='cancel'){if(await requestLeave())await ui.refresh();}
    if(cmd==='save')await save();
    if(cmd==='tab'){d.tab=n.dataset.tab;render();}
    if(cmd==='restore-field'){const latest=await runtime().readPlaceEdit(d.id);d.snapshot.builtin=copy(latest.builtin);if(n.dataset.field==='bindings'){d.bindings=copy(latest.builtin?.bindings||[]);if(!d.restoreFields.includes('bindings'))d.restoreFields.push('bindings');}else {restorePlaceDraftField(d,n.dataset.field);if(n.dataset.field==='type')restorePlaceDraftField(d,'typeId');}render();}
    if(cmd==='restore-body'){const latest=await runtime().readPlaceEdit(d.id);const v=latest.bodyVariants.find(v=>v.slotKey===d.bodyKey);if(v){const old=d.snapshot.bodyVariants.find(v=>v.slotKey===d.bodyKey);old.builtinBody=v.builtinBody;d.bodies[d.bodyKey]=v.builtinBody||'';if(!d.restoreBodies.includes(d.bodyKey))d.restoreBodies.push(d.bodyKey);}render();}
    if(cmd==='restore-all'){
      const latest=await runtime().readPlaceEdit(d.id),labels={name:'地点名称',type:'主要类型',fullNames:'完整激活词',parentId:'直接上级',summary:'一句话介绍'};
      const changed=Object.entries(labels).filter(([key])=>!equal(d.values[key],latest.builtin[key])||latest.overriddenFields.includes(key)).map(([,label])=>label);
      if(!equal(d.bindings,latest.builtin.bindings||[])||latest.overriddenFields.includes('bindings'))changed.push('附加资料词条');
      const texts=latest.bodyVariants.filter(v=>!v.userSlot&&(v.custom||d.bodies[v.slotKey]!==v.builtinBody));
      if(!changed.length&&!texts.length){ui.notify('当前没有需要恢复的内置修改');return;}
      const answer=await ui.ask({title:'确认整体恢复内置',message:[changed.length?'地点资料：'+changed.join('、'):'',texts.length?'正文：'+texts.map(v=>v.title||'地点正文').join('、'):'','确认后先更新本页草稿，点击保存后生效。'].filter(Boolean).join('\n'),choices:[{id:'cancel',label:'取消'},{id:'restore',label:'恢复到草稿',primary:true}]});
      if(answer!=='restore')return;
      d.snapshot.builtin=copy(latest.builtin);for(const v of d.snapshot.bodyVariants){v.builtinBody=latest.bodyVariants.find(row=>row.slotKey===v.slotKey)?.builtinBody||'';}restorePlaceDraftAll(d);render();
    }
    if(cmd==='parent-search')await findParents(d.parentQuery||'');
    if(cmd==='parent'){d.values.parentId=n.dataset.id;d.parentLabel=parentResults.find(row=>row.id===n.dataset.id)?.name||'';parentResults=[];render();}
    if(cmd==='parent-clear'){d.values.parentId=null;render();}
    if(cmd==='pick'){suspend();await ui.beginPositionPick(d.values.coordinates);}
  }
  return {open,render,resume:render,suspend,requestLeave,dirty,save};
}
