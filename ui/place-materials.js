import { esc } from './dom.js';
import { BUILTIN_MATERIAL_CATEGORIES, MATERIAL_LAYER_LABELS } from '../src/material-catalog.js';
import { VENUE_MATERIAL_CATEGORIES } from '../src/venue-material-catalog.js';
import { normalizeSearchText } from '../src/search-text.js';
import { fragmentConditionText } from './material-editor.js';

const bindingRoles = new Map(VENUE_MATERIAL_CATEGORIES.map(row => [row.id, row.nodeRole]));
const outdoorTypeFamilies = new Set(['ex.residential','ex.commercial','ex.nightlife','ex.center','ex.historic','ex.industry','ex.open-space','ex.streets','ex.rural','ex.waterfront']);
const outdoorTypeIds = new Set(BUILTIN_MATERIAL_CATEGORIES.filter(row => row.layer === 'EX' && outdoorTypeFamilies.has(row.id.split('.').slice(0,2).join('.'))).map(row => row.id));
const typeHint = '不了解展开机制，不建议勾选，与本地点性质类型无关。';
const layers = Object.entries(MATERIAL_LAYER_LABELS);
const groupOf = category => {
  const role = category.nodeRole || bindingRoles.get(category.id);
  return (role ? role === 'place_type' : outdoorTypeIds.has(category.id)) ? 'types' : 'ordinary';
};
export function groupPlaceBindingCategories(categories) {
  const groups = { ordinary: [], types: [] };
  for (const category of categories) groups[groupOf(category)].push(category);
  return groups;
}

// LJ-PLACE-MATERIAL-WORKFLOW-20261103: choose stable category IDs from the live library; save through the place draft.
export function buildPlaceMaterialIndex(categories) {
  const source = Array.isArray(categories) ? categories : Object.values(categories || {});
  const categoryMap = new Map(source.map(row => [row.id, row]));
  const rows = source.map(category => {
    const path = [], seen = new Set();
    let ancestor = category;
    while (ancestor && !seen.has(ancestor.id)) {
      path.unshift(ancestor); seen.add(ancestor.id); ancestor = categoryMap.get(ancestor.parentId);
    }
    const group = groupOf(category);
    const parent = path.slice(0,-1).reverse().find(row => groupOf(row) === group);
    const pathText = [MATERIAL_LAYER_LABELS[category.layer], ...path.map(row => row.name)].filter(Boolean).join(' › ');
    return { id:category.id, category, group, parentId:parent?.id || null, path, pathText, search:normalizeSearchText(pathText), children:[] };
  });
  const byId = new Map(rows.map(row => [row.id, row]));
  for (const row of rows) if (row.parentId) byId.get(row.parentId)?.children.push(row.id);
  return { rows, byId };
}

export function materialPickerPage(model, state, bindings, pageSize=48) {
  const tokens = normalizeSearchText(state.query).split(' ').filter(Boolean);
  const pending = new Set(state.pending || []);
  let rows;
  if (state.list === 'pending') rows = model.rows.filter(row => pending.has(row.id));
  else if (tokens.length) rows = model.rows.filter(row => tokens.every(token => row.search.includes(token)));
  else rows = model.rows.filter(row => row.group === state.group && (!state.layer || row.category.layer === state.layer) && row.parentId === state.parentId);
  rows = [...rows.filter(row => row.group === 'ordinary'), ...rows.filter(row => row.group === 'types')];
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(0,state.page || 0),pageCount-1);
  return { rows:rows.slice(page*pageSize,(page+1)*pageSize), total:rows.length, pageCount, page };
}

export function togglePendingMaterial(state, bindings, id) {
  if (bindings.some(row => row.categoryId === id)) return;
  state.pending ||= [];
  state.pending = state.pending.includes(id) ? state.pending.filter(value => value !== id) : [...state.pending,id];
}
export function commitPendingMaterials(draft) {
  const state = draft.materials;
  if (!state) return;
  const linked = new Set(draft.bindings.map(row => row.categoryId));
  for (const id of state.pending || []) if (!linked.has(id)) {
    draft.bindings.push({categoryId:id,enabled:true}); linked.add(id);
  }
  state.pending=[]; state.view='linked'; state.preview=null;
}

export function materialPreviewVersions(engine, categoryId) {
  const library = engine.data.materialLibrary;
  if (!library) return [];
  const packages = new Map(engine.data.packages.filter(item => item.materialFragmentId).map(item => [item.materialFragmentId,item]));
  return Object.values(library.fragments).filter(fragment => fragment.categoryId === categoryId)
    .sort((a,b) => Number(Boolean(b.ownBody))-Number(Boolean(a.ownBody)))
    .flatMap(fragment => {
      const item = packages.get(fragment.id);
      if (!item) return [];
      return engine.editableVariantsForPackage(item.id).map(variant => ({
        ...variant, packageId:item.id, fragment,
        label:[fragment.ownBody?'本级正文':fragment.title, fragment.regionId === '@any' ? '不限地域' : library.regions[fragment.regionId]?.name, variant.calendarSegmentId ? variant.label || variant.calendarSegmentId : ''].filter(Boolean).join(' · '),
        conditions:fragmentConditionText(library,fragment),
      }));
    });
}

export function placeMaterialsState(draft) {
  return draft.materials ||= {view:'linked',group:'ordinary',layer:'',parentId:null,query:'',list:'browse',page:0,pending:[],more:null,preview:null,positions:{}};
}

export function createPlaceMaterialsPanel(ui, {render, getHost, changed}) {
  const current = () => ui.state.placeEditor;
  const state = () => placeMaterialsState(current());
  const index = () => buildPlaceMaterialIndex(ui.engine.data.materialLibrary?.categories || {});
  const key = s => s.view === 'preview' ? `preview:${s.preview.categoryId}:${s.preview.slotKey || ''}` : s.view === 'choose' ? `choose:${s.list}:${s.group}:${s.layer}:${s.parentId || ''}:${s.query}:${s.page}` : 'linked';
  function capture(host) {
    const draft=current();
    if (!draft?.materials || !host?.dataset.materialViewKey) return;
    const content=host.querySelector('.lj-place-content'), focused=host.contains(document.activeElement)?document.activeElement:null;
    draft.materials.positions[host.dataset.materialViewKey] = {top:content?.scrollTop || 0,focus:focused?.dataset.pmFocus || '',start:focused?.selectionStart,end:focused?.selectionEnd};
  }
  function restore(host) {
    const s=state();host.dataset.materialViewKey=key(s);
    const position=s.positions[key(s)];if(!position)return;
    const content=host.querySelector('.lj-place-content');if(content)content.scrollTop=position.top;
    const focus=[...host.querySelectorAll('[data-pm-focus]')].find(node=>node.dataset.pmFocus===position.focus);
    if(focus){focus.focus({preventScroll:true});if(typeof focus.setSelectionRange==='function'&&position.start!=null)focus.setSelectionRange(position.start,position.end);}
  }
  const button = (action,label,extra='') => `<button type="button" data-pm-action="${action}" ${extra}>${label}</button>`;
  const path = row => `<small class="lj-material-path">${esc(row?.pathText || '词条已不在当前分类中')}</small>`;
  const hint = () => `<p class="lj-place-binding-hint">${typeHint}</p>`;
  function linkedMarkup(draft,locked,restoreControl) {
    const model=index(),s=state(),paused=draft.bindings.filter(row=>row.enabled===false).length;
    return `<div class="lj-material-toolbar"><div><strong>附加资料</strong><span class="lj-material-count">${draft.bindings.length} 个${paused?` · ${paused} 暂停`:''}</span></div>${locked?'':button('add','添加词条','class="primary" data-pm-focus="add"')}</div><div class="lj-material-explanation"><p class="lj-place-note">按词条自身的条件和开关取用。这里的暂停只影响本地点。</p>${restoreControl}</div>${draft.bindings.length ? `<div class="lj-material-list">${draft.bindings.map(binding=>{
      const row=model.byId.get(binding.categoryId),id=esc(binding.categoryId),paused=binding.enabled===false,more=s.more===binding.categoryId;
      return `<div class="lj-material-linked"><div class="lj-material-linked-main"><div class="lj-material-identity"><strong>${esc(row?.category.name || binding.categoryId)}</strong>${path(row)}<span class="lj-material-status ${paused?'is-paused':''}">${paused?'本地点暂停':'本地点启用'}</span></div><div class="lj-material-actions">${row?button('preview','查看',`data-id="${id}" data-pm-focus="view:${id}"`):''}${locked?'':button('more','更多',`data-id="${id}" data-pm-focus="more:${id}" aria-expanded="${more}"`)}</div></div>${more&&!locked?`<div class="lj-material-more">${button('toggle',paused?'在本地点启用':'在本地点暂停',`data-id="${id}"`)}${button('remove','移除挂接',`data-id="${id}"`)}</div>`:''}</div>`;
    }).join('')}</div>`:`<div class="lj-material-empty"><strong>还没有附加资料</strong><p>${locked?'此地点的挂接保持内置。':'点击“添加词条”，按分类或搜索选择。'}</p></div>`}`;
  }
  function candidateRow(row,draft,s) {
    const binding=draft.bindings.find(item=>item.categoryId===row.id),selected=s.pending.includes(row.id),id=esc(row.id);
    return `<div class="lj-material-candidate"><label class="lj-material-choice"><input type="checkbox" data-pm-choice="${id}" data-pm-focus="choice:${id}" ${selected||binding?'checked':''} ${binding?'disabled':''}><span><strong>${esc(row.category.name)}</strong>${path(row)}${binding?`<span class="lj-material-status ${binding.enabled===false?'is-paused':''}">${binding.enabled===false?'已挂接 · 本地点暂停':'已挂接 · 本地点启用'}</span>`:''}</span></label><div class="lj-material-actions">${button('preview','查看',`data-id="${id}" data-pm-focus="view:${id}"`)}${row.children.length?button('children','下级 ›',`data-id="${id}" data-pm-focus="children:${id}" aria-label="展开${esc(row.category.name)}的下级"`):''}</div></div>`;
  }
  function chooserResults(draft) {
    const s=state(),model=index(),search=Boolean(s.query.trim()),root=s.list==='browse'&&!search&&!s.layer&&s.group==='ordinary'&&!s.parentId;
    if(root)return `<p class="lj-place-note">先选分类，或搜索名称与归属路径。勾选只添加当前词条。</p><div class="lj-material-layer-grid">${layers.map(([id,name])=>button('layer',`${esc(name)}<span>›</span>`,`data-layer="${id}" data-pm-focus="layer:${id}"`)).join('')}</div><div class="lj-material-type-entry">${button('types','类型词条 <span>›</span>','data-pm-focus="types"')}<p class="lj-place-note">单独浏览地点性质与业态词条。</p></div>`;
    const result=materialPickerPage(model,s,draft.bindings);s.page=result.page;
    const parent=model.byId.get(s.parentId),location=parent?.pathText||(s.group==='types'?'类型词条':MATERIAL_LAYER_LABELS[s.layer]);
    let lastGroup=null;
    const rows=result.rows.map(row=>{
      let heading='';
      if(row.group!==lastGroup&&(search||s.list==='pending'))heading=`<div class="lj-place-binding-heading">${row.group==='types'?'类型词条':'一般资料词条'}</div>${row.group==='types'?hint():''}`;
      lastGroup=row.group;return heading+candidateRow(row,draft,s);
    }).join('');
    return `${!search&&s.list==='browse'?`<div class="lj-material-location">${button('up','‹ 上一级','data-pm-focus="up"')}<span>${esc(location)}</span></div>${s.group==='types'?hint():''}`:''}<div class="lj-material-result-count">${s.list==='pending'?'本次待添加':search?'搜索结果':'当前分类'} · ${result.total} 个</div>${rows||`<div class="lj-material-empty"><strong>${s.list==='pending'?'还没有待选词条':search?'没有匹配的词条':'此分类暂无词条'}</strong>${s.list==='pending'?button('browse','返回浏览'):search?button('clear-search','清空搜索'):''}</div>`}${result.pageCount>1?`<div class="lj-material-pagination">${button('previous','上一页',`${result.page===0?'disabled':''}`)}<span>${result.page+1} / ${result.pageCount}</span>${button('next','下一页',`${result.page===result.pageCount-1?'disabled':''}`)}</div>`:''}`;
  }
  function chooserMarkup(draft) {
    const s=state();
    return `<div class="lj-material-picker-tools"><div class="lj-material-search"><label class="lj-sr-only" for="lj-place-material-query">搜索词条名称或分类</label><input id="lj-place-material-query" type="search" data-pm-query data-pm-focus="query" placeholder="搜索词条名称或分类" value="${esc(s.query)}" autocomplete="off"></div><div class="lj-material-view-tabs" aria-label="选择范围">${button('browse','浏览',`aria-pressed="${s.list==='browse'}" data-pm-focus="browse"`)}${button('pending',`待选 <span data-pm-pending-count>${s.pending.length}</span>`,`aria-pressed="${s.list==='pending'}" data-pm-focus="pending"`)}</div></div><div data-pm-results>${chooserResults(draft)}</div>`;
  }
  function previewMarkup() {
    const s=state(),p=s.preview,model=index(),row=model.byId.get(p.categoryId),versions=materialPreviewVersions(ui.engine,p.categoryId);
    const selected=versions.find(v=>v.slotKey===p.slotKey)||versions.find(v=>v.packageId===p.packageId)||versions[0];
    p.packageId=selected?.packageId||null;p.slotKey=selected?.slotKey||null;
    const overrides=ui.engine.normalizeTextOverrides(ui.bridge.store.read().livingJapanTextOverrides);
    const body=selected?(overrides.records[selected.slotKey]?.body??selected.body??''):'';
    return `<div class="lj-material-preview-title"><h3>${esc(row?.category.name||p.categoryId)}</h3>${path(row)}</div>${versions.length>1?`<label class="lj-place-label" for="lj-place-material-version">正文版本与适用情况</label><select id="lj-place-material-version" data-pm-version data-pm-focus="version">${versions.map(v=>`<option value="${esc(v.slotKey)}" ${v.slotKey===selected?.slotKey?'selected':''}>${esc(v.label)}</option>`).join('')}</select>`:selected?`<strong class="lj-material-version-label">${esc(selected.label)}</strong>`:''}${selected?`<p class="lj-place-note lj-material-conditions">${esc(selected.conditions)}</p>`:''}${p.loading?'<p role="status" class="lj-place-note">正在读取正文…</p>':p.error?`<div class="lj-material-empty" role="alert"><strong>正文读取失败</strong><p>${esc(p.error)}</p>${button('retry-preview','重新读取')}</div>`:`<article class="lj-material-preview-body">${body?esc(body):`<p class="lj-material-empty">${selected?'此版本暂无正文':'暂无正文'}</p>`}</article>`}`;
  }
  function markup(draft,locked,restoreControl='') {
    const s=placeMaterialsState(draft);
    if(s.view==='choose')return {immersive:true,header:`${button('cancel-choice','‹ 返回','data-pm-focus="cancel-choice"')}<strong>添加词条</strong>`,content:chooserMarkup(draft),footer:`<span role="status">待添加 <b data-pm-pending-count>${s.pending.length}</b> 个</span>${button('cancel-choice','取消')}${button('complete','完成选择',`class="primary" data-pm-complete ${s.pending.length?'':'disabled'}`)}`};
    if(s.view==='preview'){
      const content=previewMarkup();
      return {immersive:true,header:`${button('back-preview','‹ 返回','data-pm-focus="back-preview"')}<strong>查看词条</strong>`,content,footer:`<span>共享资料；地点草稿会保留</span>${s.preview.packageId?button('edit-material','在资料页编辑',`class="primary" ${s.preview.loading?'disabled':''}`):''}`};
    }
    return {immersive:false,content:linkedMarkup(draft,locked,restoreControl)};
  }
  function updateSearch(host) {
    const d=current(),s=state(),results=host.querySelector('[data-pm-results]');
    if(results)results.innerHTML=chooserResults(d);
    host.dataset.materialViewKey=key(s);
    const content=host.querySelector('.lj-place-content');if(content)content.scrollTop=0;
  }
  function input(event,host) {
    if(!event.target.hasAttribute('data-pm-query'))return false;
    const s=state();s.query=event.target.value;s.page=0;s.list='browse';
    if(!event.isComposing)updateSearch(host);
    for(const node of host.querySelectorAll('[data-pm-action="browse"],[data-pm-action="pending"]'))node.setAttribute('aria-pressed',String(node.dataset.pmAction===s.list));
    return true;
  }
  async function loadPreview() {
    const d=current(),s=state(),p=s.preview;
    if(!p)return;
    const request=p.request=(p.request||0)+1;
    const versions=materialPreviewVersions(ui.engine,p.categoryId),selected=versions.find(v=>v.slotKey===p.slotKey)||versions[0];
    p.packageId=selected?.packageId||null;p.slotKey=selected?.slotKey||null;
    if(!selected){p.loading=false;p.error='';render();return;}
    p.loading=true;p.error='';render();
    try{await ui.bridge.session.ensureBodies?.([selected.packageId]);}
    catch(error){if(current()===d&&s.preview===p&&p.request===request){p.error=error.message||'请重新读取。';ui.notify('正文读取失败：'+p.error,'error');}}
    finally{if(current()===d&&s.preview===p&&p.request===request){p.loading=false;render();}}
  }
  async function change(event) {
    const n=event.target,d=current(),s=state();
    if(n.dataset.pmChoice){if(d.snapshot.permissions.structure){togglePendingMaterial(s,d.bindings,n.dataset.pmChoice);render();}return true;}
    if(n.hasAttribute('data-pm-version')){capture(getHost());s.preview.slotKey=n.value;await loadPreview();return true;}
    return false;
  }
  async function action(n) {
    const d=current(),s=state(),cmd=n.dataset.pmAction,id=n.dataset.id,locked=!d.snapshot.permissions.structure;
    capture(getHost());
    if(['add','complete','toggle','remove'].includes(cmd)&&locked)return;
    if(cmd==='add'){Object.assign(s,{view:'choose',pending:[],query:'',list:'browse',group:'ordinary',layer:'',parentId:null,page:0,preview:null});}
    if(cmd==='cancel-choice'){s.pending=[];s.view='linked';s.preview=null;}
    if(cmd==='complete'){commitPendingMaterials(d);changed();}
    if(cmd==='more')s.more=s.more===id?null:id;
    if(cmd==='toggle'){const binding=d.bindings.find(row=>row.categoryId===id);if(binding)binding.enabled=binding.enabled===false;s.more=null;changed();}
    if(cmd==='remove'){d.bindings=d.bindings.filter(row=>row.categoryId!==id);s.more=null;changed();}
    if(cmd==='layer')Object.assign(s,{group:'ordinary',layer:n.dataset.layer,parentId:null,page:0,list:'browse',query:''});
    if(cmd==='types')Object.assign(s,{group:'types',layer:'',parentId:null,page:0,list:'browse',query:''});
    if(cmd==='children'){const row=index().byId.get(id);Object.assign(s,{group:row.group,layer:row.category.layer,parentId:id,page:0,list:'browse',query:''});}
    if(cmd==='up'){
      const row=index().byId.get(s.parentId);
      if(row){s.parentId=row.parentId;if(s.group==='types'&&!s.parentId)s.layer='';}
      else Object.assign(s,{group:'ordinary',layer:'',parentId:null});
      s.page=0;
    }
    if(cmd==='browse'||cmd==='pending'){s.list=cmd;s.page=0;}
    if(cmd==='clear-search'){s.query='';s.page=0;}
    if(cmd==='previous')s.page=Math.max(0,s.page-1);
    if(cmd==='next')s.page++;
    if(cmd==='preview'){s.preview={categoryId:id,from:s.view,slotKey:null,packageId:null,loading:false};s.view='preview';await loadPreview();return;}
    if(cmd==='retry-preview'){await loadPreview();return;}
    if(cmd==='back-preview'){s.view=s.preview.from;s.preview=null;}
    if(cmd==='edit-material'){if(s.preview.loading)return;await ui.editPlaceMaterial(s.preview.packageId,s.preview.slotKey);return;}
    render();
  }
  return {markup,capture,restore,input,change,action};
}
