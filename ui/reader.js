import { $, $$, esc } from './dom.js';
import { userPackageId } from '../src/baseline.js';
import { buildMaterialsModel, materialState } from './materials.js';
import { isPlaceBodyPackage } from '../src/material-library.js';
import { packageDisplayName, placeIdentityInfo, placeIntroduction } from '../src/place-metadata.js';
import { fragmentConditionText } from './material-editor.js';
import { placeIdentityIds, placeStorageId } from '../src/place-identities.js';
import { metroEntityTitle } from '../src/metro-names.js';

// LJ-READER-LIVE-01: empty reads, docked editing and same-object navigation share one retained draft.
export function createReader(ui) {
  let active=null, overlay=null, mode='read', compareReturn='read', base='', buffer='', busy=false, model, modelData;
  const buffers=ui.state.readerBuffers ||= new Map(), positions=ui.state.readerPositions ||= new Map();
  const engine=()=>ui.bridge.session.engine;
  const overrides=()=>engine().normalizeTextOverrides(ui.bridge.store.read().livingJapanTextOverrides);
  const saved=v=>v ? overrides().records[v.slotKey]?.body ?? v.body ?? '' : '';
  function packageIds(entity) { const ids=new Set(placeIdentityIds(entity,engine().data));return [...new Set([...(entity.packageIds||[]),...engine().data.packages.filter(p=>!p.materialAnchor&&ids.has(p.placeId)).map(p=>p.id)])].filter(id=>engine().data.packages.some(p=>p.id===id&&!p.materialAnchor)); }
  function variantsFor(entity) { return packageIds(entity).flatMap(id=>engine().editableVariantsForPackage(id).map(v=>({...v,title:metroEntityTitle(entity,packageDisplayName(engine().data.packages.find(p=>p.id===id),engine().data))||entity.name}))); }
  function isDirty() { return Boolean(active?.variant&&buffer!==base); }
  function rememberPosition() {
    if(!active||!overlay)return;
    const node=mode==='edit'?$('textarea',overlay):$('article',overlay);
    if(node)positions.set((active.variant?.slotKey||active.entity.id)+':'+mode,{top:node.scrollTop,start:node.selectionStart,end:node.selectionEnd,focused:document.activeElement===node});
  }
  function bindVariant(v) {active.variant=v;base=saved(v);buffer=v?(buffers.get(v.slotKey)??base):'';}
  async function save() {
    if(!active?.variant||busy)return false;
    rememberPosition();const target=active.variant,body=buffer;busy=true;render();
    try { await ui.bridge.session.runtime.saveTextOverride(target.packageId,target.calendarSegmentId,body);base=saved(target);buffer=base;buffers.delete(target.slotKey);ui.notify('修改稿已保存并读回');await ui.refresh();return true; }
    catch(error){ui.notify(error.message,'error');return false;}
    finally{busy=false;render();}
  }
  async function leave() {
    if(busy){ui.notify('正在保存并读回，请稍候');return false;}
    rememberPosition();if(!isDirty())return true;
    const result=await ui.ask({title:'还有未保存的修改',message:'离开前可以保存，也可以放弃这次修改。',choices:[{id:'cancel',label:'留在编辑'},{id:'discard',label:'不保存并继续'},{id:'save',label:'保存并继续',primary:true}]});
    if(result==='save')return save();
    if(result==='discard'){buffers.delete(active.variant.slotKey);buffer=base;return true;}
    return false;
  }
  function suspend() {rememberPosition();overlay?.parentElement?.classList.remove('has-text');overlay?.remove();overlay=null;active=null;}
  async function close() {if(await leave()){suspend();return true;}return false;}
  async function newSlot(entity) {
    const result=await ui.ask({title:'新增正文空位',message:`为“${entity.name}”保存一份独立正文。空位数量可继续增加。`,fields:[{id:'title',label:'正文名称',value:`${entity.name} · 新正文`},{id:'layer',label:'所属资料',options:[{value:'EX',label:'外部地域'},{value:'IN',label:'内部场所'}]}],choices:[{id:'cancel',label:'取消'},{id:'create',label:'建立空位',primary:true}]});
    if(result.id!=='create')return null;
    const id=crypto.randomUUID(),definition={id,entityId:placeStorageId(entity,engine().data),name:entity.name,title:result.values.title.trim()||entity.name,layer:result.values.layer,adminPath:entity.adminPath||[],adminNodes:entity.adminNodes||[],aliases:entity.aliases||[],fullNames:entity.fullNames?.length?entity.fullNames:[entity.activationName||entity.name],type:entity.type,coordinates:entity.coordinates||null,regionCode:entity.regionCode||ui.state.regionCode};
    await ui.bridge.store.update(data=>{data.customSlots[id]=definition;return data;});await ui.bridge.refresh();return userPackageId(id);
  }
  async function open(entity,packageId=null,editing=false,view=null) {
    if(active?.entity.id===entity.id&&(!packageId||packageId===active.variant?.packageId)&&!view){if(editing)mode='edit';render();return true;}
    if(!(await leave()))return false;
    await ui.bridge.session.ensureBodies?.(packageId?[packageId]:packageIds(entity));
    await ui.bridge.session.ensureSummaries?.([entity]);
    const variants=variantsFor(entity),filtered=packageId?variants.filter(v=>v.packageId===packageId):variants;
    active={entity,variants};bindVariant(filtered.find(v=>v.slotKey===view?.slotKey)||filtered[0]||variants[0]||null);mode=view?.mode||(editing&&active.variant?'edit':'read');compareReturn=view?.compareReturn||'read';mount();render();return true;
  }
  async function edit() {
    const item=engine().data.packages.find(p=>p.id===active.variant?.packageId);
    if(ui.placeEditor&&(isPlaceBodyPackage(item)||(!item&&!active.entity.materialFragmentId)))return ui.placeEditor.open(active.entity,{tab:'text',bodyKey:active.variant?.slotKey});
    if(!active.variant){const entity=active.entity,id=await newSlot(entity);if(!id)return;active.variants=variantsFor(entity);bindVariant(active.variants.find(v=>v.packageId===id));}
    mode='edit';render();
  }
  async function toggleBody() {
    if(!active.variant)return;
    const settings=engine().normalizeSettings(ui.bridge.store.read().livingJapanSettings);
    settings.packages[active.variant.packageId]=settings.packages[active.variant.packageId]===false;
    await ui.bridge.session.runtime.saveSettings(settings);await ui.refresh();render();
  }
  function mount() {
    if(!$('#ljReaderStyle')){const link=document.createElement('link');link.id='ljReaderStyle';link.rel='stylesheet';link.href=new URL('./reader.css',import.meta.url).href;document.head.append(link);}
    overlay?.parentElement?.classList.remove('has-text');overlay?.remove();
    overlay=document.createElement('section');overlay.className='lj-reader-overlay';overlay.setAttribute('aria-label','正文阅读与编辑');
    const dock=ui.layout==='desktop'&&ui.state.page==='package'?$('#ljPackageTextDock'):null;
    const desktopRoot=$$('.work7').find(n=>!n.closest('[hidden]'));
    if(dock){overlay.classList.add('lj-reader-docked');dock.classList.add('has-text');dock.append(overlay);}
    else (ui.layout==='desktop'?desktopRoot||document.body:$('#device')||document.body).append(overlay);
    overlay.addEventListener('click',async event=>{
      const target=event.target.closest('[data-reader]');if(!target||busy)return;const action=target.dataset.reader;rememberPosition();
      try {
        if(action==='close')await close();
        if(action==='return-place')await ui.returnToPlace();
        if(action==='place-materials')await ui.materialEditor.showPlace(active.entity);
        if(['read','original'].includes(action)){mode=action;render();}
        if(action==='compare'){if(mode==='original')mode=compareReturn;else{compareReturn=mode;mode='original';}render();}
        if(action==='info-close')$('[data-reader-info]',overlay).open=false;
        if(action==='edit')await edit();
        if(action==='save')await save();
        if(action==='conditions')await ui.materialEditor.editFragment(engine().data.packages.find(p=>p.id===active.variant?.packageId)?.materialFragmentId);
        if(action==='keywords')await ui.materialEditor.editKeywords(engine().data.materialLibrary?.fragments[engine().data.packages.find(p=>p.id===active.variant?.packageId)?.materialFragmentId]?.categoryId);
        if(action==='introduction')await ui.materialEditor.editIntroduction(active.entity);
        if(action==='toggle')await toggleBody();
        if(action==='material'&&active.variant)await ui.locateMaterial(active.entity,active.variant.packageId,mode==='edit');
        if(action==='region')await ui.locateRegion(active.entity,active.variant?.packageId,mode==='edit');
        if(action==='new'){
          if(!(await leave()))return;const entity=active.entity,id=await newSlot(entity);
          if(id)await open(entity,id,true);
        }
        if(action==='restore'&&active.variant){
          const confirmed=await ui.ask({title:'恢复当前正文的内置原文',message:'只移除当前这份修改稿，其他正文和空位保持不变。',choices:[{id:'cancel',label:'取消'},{id:'restore',label:'恢复原文',primary:true}]});
          if(confirmed==='restore'){await ui.bridge.session.runtime.removeTextOverride(active.variant.packageId,active.variant.calendarSegmentId);base=saved(active.variant);buffer=base;buffers.delete(active.variant.slotKey);ui.notify('当前正文已恢复原文');await ui.refresh();render();}
        }
      }catch(error){ui.notify(error.message,'error');}
    });
    overlay.addEventListener('input',event=>{if(event.target.matches('textarea')&&active.variant){buffer=event.target.value;buffers.set(active.variant.slotKey,buffer);$('[data-reader-state]',overlay).textContent=isDirty()?'有未保存修改':'与已保存内容一致';$('[data-reader-count]',overlay).textContent=`${buffer.length} 字符`;$('[data-reader="save"]',overlay).disabled=busy||!isDirty();}});
    overlay.addEventListener('change',async event=>{if(event.target.matches('select')){const key=event.target.value;if(!(await leave())){event.target.value=active.variant.slotKey;return;}const target=active.variants.find(v=>v.slotKey===key);await ui.bridge.session.ensureBodies?.([target.packageId]);active.variants=variantsFor(active.entity);bindVariant(active.variants.find(v=>v.slotKey===key));render();}});
  }
  function render() {
    if(!overlay||!active)return;
    const v=active.variant,entity=active.entity,record=v&&overrides().records[v.slotKey],changed=record&&record.baseBuiltinSha256!==v.bodySha256;
    const p=v&&engine().data.packages.find(p=>p.id===v.packageId);
    const fragment=p?.materialFragmentId&&engine().data.materialLibrary?.fragments[p.materialFragmentId];
    const hasPlaceIdentity=isPlaceBodyPackage(p)||(!p&&!entity.materialFragmentId);
    const identity=placeIdentityInfo(entity,p,engine().data);
    let state={own:true,reasons:[]};
    if(p){if(modelData!==engine().data){modelData=engine().data;model=buildMaterialsModel(engine());}const node=model.packageNodes.get(p.id);if(node)state=materialState(node,engine().normalizeSettings(ui.bridge.store.read().livingJapanSettings),model,'body');}
    const path=(entity.adminNodes||[]).filter(n=>n.id!=='admin:jp').map(n=>n.label||n.name||n.nameJa).filter(Boolean).join(' › ');
    const source=!v?'此地点尚未建立正文。':changed?'内置原文已更新，你的修改稿已保留。':record?'当前使用你保存的修改稿。':v.body?'当前使用内置原文。':'此空位尚无正文，可以补写。';
    const text=mode==='edit'?buffer:mode==='original'?(v?.body||'此空位没有内置原文。'):(saved(v)||(v?'此空位尚未保存正文。':'此地点尚无正文；需要撰写时可新增正文空位。'));
    // LJ-APPROVED-READER-CONTROLS-20261030: retain the final template toolbars around live drafts and metadata.
    const desktop=ui.layout==='desktop',docked=desktop&&ui.state.page==='package',buttonClass=desktop?'loc10-button':'btn text';
    // LJ-MATERIAL-READER-20261030: fragments reuse the reader without pretending to own a map location.
    const keywords=fragment?engine().data.materialLibrary.categories[fragment.categoryId]?.activationKeywords||[]:[];
    const identityMarkup=fragment?`<p>词条：${esc(engine().data.materialLibrary.categories[fragment.categoryId]?.name)}</p><p>${esc(fragmentConditionText(engine().data.materialLibrary,fragment))}</p><p>独立有效词：${keywords.length?esc(keywords.slice(0,3).join('、'))+(keywords.length>3?' 等 '+keywords.length+' 个':''):'未设置'}</p>${fragment.familyId&&!fragment.ownBody?'<p>沿用已有版本关系</p>':''}`:`<p>${esc([entity.displayType||entity.type,path].filter(Boolean).join(' · '))}</p><p>原名：${esc(identity.originalName)}</p>${identity.sourceName?`<p>来源记名：${esc(identity.sourceName)}</p>`:''}${identity.aliases.length?`<p>别名：${esc(identity.aliases.join('、'))}</p>`:''}${identity.fullTriggers.length?`<p>完整激活名：${esc(identity.fullTriggers.join('、'))}</p>`:''}`;
    const info=`<details class="${desktop?'lj-reader-info':'ljv-reader-info'}" data-reader-info><summary>资料信息</summary><section class="lj-reader-info-panel"><header class="lj-reader-info-head"><b>资料信息</b><button type="button" class="${buttonClass}" data-reader="info-close" aria-label="关闭资料信息">×</button></header><div class="lj-reader-identity">${identityMarkup}${hasPlaceIdentity?`<p>一句话介绍：${esc(placeIntroduction(entity,engine().data)||'暂无')}</p>`:''}${state.reasons.length?`<p>暂停原因：${esc(state.reasons.join('；'))}</p>`:''}</div>${hasPlaceIdentity?`<button type="button" class="${buttonClass}" data-reader="introduction">编辑一句话介绍</button>`:''}${fragment?`<button type="button" class="${buttonClass}" data-reader="keywords">独立有效词</button>`:''}${fragment||hasPlaceIdentity?`<button type="button" class="${buttonClass}" data-reader="${fragment?'conditions':'new'}">${fragment?'编辑适用条件':'新增正文空位'}</button>`:''}</section></details>`;
    const tools=`<div class="${desktop?'lj-text-meta':'ljv-reader-tools'}">${hasPlaceIdentity?`<button type="button" class="${buttonClass} lj-reader-shortcut" data-reader="region">在地区中定位</button><button type="button" class="${buttonClass} lj-reader-shortcut" data-reader="place-materials">附加资料</button>`:`<button type="button" class="${buttonClass} lj-reader-shortcut" data-reader="material" ${v?'':'disabled'}>在列表中定位</button>`}${info}</div>`;
    const placeReturn=!desktop&&ui.state.page==='package'&&ui.canReturnToPlace?.()?'<div class="lj-reader-place-return"><button type="button" data-reader="return-place">← 返回地点编辑</button><span>词条正文单独保存；地点草稿已保留。</span></div>':'';
    const own=v?`<label class="${desktop?'lj-reader-own':'mv-switch'}"><span>正文</span><button type="button" class="${desktop?'lj-switch':'switch'+(state.own?' on':'')}" data-reader="toggle" aria-label="本级正文开关" aria-pressed="${state.own}"></button></label>`:'';
    const allowed=!v?'本项无正文':state.own&&!state.reasons.length?'开关允许取用':'正文已暂停';
    const modes=docked?[['read','阅读正文'],['edit','编辑修改稿']]:[['read',desktop?'当前正文':'阅读正文'],['original',desktop?'内置原文':'查看原文'],['edit','编辑修改稿']];
    const tabs=`<nav class="${desktop?'lj-text-tabs':'ljv-reader-tabs'}" aria-label="正文与修改稿">${modes.map(([id,label])=>`<button type="button" class="${mode===id||(docked&&id==='read'&&mode==='original')?'on':''}" data-reader="${id}" aria-pressed="${mode===id||(docked&&id==='read'&&mode==='original')}">${label}</button>`).join('')}${docked?`<button type="button" class="lj-text-compare" data-reader="compare" aria-pressed="${mode==='original'}">${mode==='original'?(compareReturn==='edit'?'返回编辑':'返回正文'):'查看原文'}</button>`:''}</nav>`;
    const variants=active.variants.length>1?`<select class="lj-select" aria-label="正文与日期分支">${active.variants.map(variant=>`<option value="${esc(variant.slotKey)}" ${variant.slotKey===v?.slotKey?'selected':''}>${esc(variant.title+(variant.calendarSegmentId?' · '+variant.label:''))}</option>`).join('')}</select>`:'';
    overlay.innerHTML=`<header class="lj-reader-head${desktop?'':' text-head'}">${docked?'':`<button type="button" class="${buttonClass} back" data-reader="close">← 返回</button>`}<strong>${esc(v?.title||entity.name)}</strong>${desktop?tools:''}</header>${placeReturn}${desktop?'':tools+`<div class="ljv-reader-controls mv-reader-controls"><div class="mv-reader-own">${own}<span class="mv-reader-state">${esc(allowed)}</span></div></div>`}<div class="lj-reader-tabs">${tabs}${variants}</div><div class="lj-reader-main"><div class="lj-reader-statebar"><span class="lj-status">${esc(source)}</span><span class="lj-status" data-reader-count>${v?text.length:0} 字符</span>${desktop&&v?`<span class="lj-status">${esc(allowed)}</span>${own}`:''}</div>${mode==='edit'&&v?`<textarea class="text-editor" aria-label="编辑修改稿" spellcheck="false">${esc(buffer)}</textarea>`:`<article class="text-view" tabindex="0">${esc(text)}</article>`}</div><footer class="lj-reader-footer${desktop?'':' text-footer'}"><span class="lj-status" data-reader-state>${busy?'正在保存并确认…':isDirty()?'有未保存修改':'当前没有待保存修改'}</span><button type="button" class="${desktop?'loc10-button':'btn'}" data-reader="restore" ${record?'':'disabled'}>恢复原版</button><button type="button" class="${desktop?'loc10-button':'btn primary'}" data-reader="save" ${mode==='edit'?'':'hidden'} ${busy||!isDirty()?'disabled':''}>保存修改稿</button></footer>`;
    const position=positions.get((v?.slotKey||entity.id)+':'+mode),node=mode==='edit'?$('textarea',overlay):$('article',overlay);
    if(position&&node){node.scrollTop=position.top||0;if(mode==='edit'){node.setSelectionRange(position.start||0,position.end||0);if(position.focused)node.focus({preventScroll:true});}}
    if(busy)overlay.querySelectorAll('button,textarea,select').forEach(node=>{node.disabled=true;});
  }
  window.addEventListener('beforeunload',event=>{if(isDirty()){event.preventDefault();event.returnValue='';}});
  async function refreshActive(){if(!active)return;const entity=active.entity,packageId=active.variant?.packageId,view={slotKey:active.variant?.slotKey,mode,compareReturn};await open(ui.getEntityForPackage?.(packageId)||entity,packageId,mode==='edit',view);}
  return {open,close,leave,suspend,isDirty,packageIds,variantsFor,newSlot,render,refreshActive,viewState:()=>({slotKey:active?.variant?.slotKey,mode,...(mode==='original'&&compareReturn==='edit'?{compareReturn}:{})})};
}
