import { $, $$, esc, button } from './dom.js';
import { createBrowseHistory } from '../src/browse-history.js';
import { createPlaceSummary } from './place-summary.js';
import { chooseRelatedIntroductions } from '../src/related-place-selection.js';
import { navigationCoordinates } from '../src/living-area-map.js';

// Rows, paths and location share direct containment and real entity IDs.
export function mountBrowser(ui) {
  const catalog=ui.bridge.catalog, desktop=ui.layout==='desktop';
  const summarize=createPlaceSummary(ui);
  const list=$(desktop?'#loc10List':'#regionList'), tree=$(desktop?'.loc10-tree':'#regionTree'), search=$(desktop?'#loc10Search':'#regionSearch');
  const modified=$(desktop?'#loc10ModifiedOnly':'#regionModifiedOnly');
  const top=catalog.navigationRoot;
  const state={current:top,offset:0,query:'',selectedId:null,expanded:[],modified:false,pathIds:[],...ui.state.browser};
  let history=createBrowseHistory(state.searchHistory);
  const scroll=desktop?list:list?.closest('.region-list-scroll');
  let restoreScroll=state.scrollTop||0;
  const expanded=new Set(state.expanded),treeOffsets=new Map(),nodes=new Map();
  let {current,offset,query,selectedId,pathIds}=state;
  let request=0,relatedRequest=0,locateRequest=0,treeRequest=0,modifiedPackages=new Set(),completedSearch=null,initialization;
  search.value=query;if(modified)modified.checked=state.modified;
  function emptyDetail(){if(desktop){$('#loc10DetailName').textContent='选择地点';$('#loc10DetailKind').textContent='';$('#loc10DetailBody').innerHTML='<div class="lj-empty">选择地点查看正文；有下级地点的对象可继续展开。</div>';}}
  emptyDetail();
  async function initialize(){
    if(!initialization)initialization=catalog.normalizeBrowseState(state).then(saved=>{
      ({current=top,offset=0,query='',selectedId=null,pathIds=[]}=saved);
      expanded.clear();for(const id of saved.expanded||[])expanded.add(id);
      history=createBrowseHistory(saved.searchHistory);restoreScroll=saved.scrollTop||0;
      if(search.value===state.query)search.value=query;
      if(modified)modified.checked=Boolean(saved.modified);
    });
    await initialization;
  }
  const known=id=>nodes.get(id)||catalog.get(id);
  async function resolveNode(id){const entity=await catalog.browseNode(id);if(entity)nodes.set(entity.id,entity);return entity;}
  const snapshot=()=>({current,offset,query,selectedId,pathIds:[...pathIds],scrollTop:scroll?.scrollTop||0,modified:Boolean(modified?.checked),regionCode:ui.state.regionCode});
  const remember=()=>{ui.state.browser={...snapshot(),expanded:[...expanded],searchHistory:history.read()};};
  scroll?.addEventListener('scroll',remember,{passive:true});
  const draftEntityIds=()=>modified?.checked?[...new Set([...ui.engine.data.packages.filter(p=>modifiedPackages.has(p.id)).map(p=>p.placeId).filter(Boolean),...(catalog.personalIds?.()||[])])]:undefined;
  const admin=e=>e?.type==='行政区'||e?.browseOnly;
  function hasDraft(e){return ui.reader.packageIds(e).some(id=>modifiedPackages.has(id));}
  function searchLocation(entity){
    const declared=new Map((entity.adminNodes||[]).map(node=>[node.id,node])),seen=new Set();
    const path=entity.adminPath?.length?entity.adminPath:[...declared.values()];
    return path.map(node=>typeof node==='string'?declared.get(node)||catalog.get(node):node).filter(node=>{
      if(!node||node.id==='admin:jp'||node.kind==='country'||node.id===entity.id||seen.has(node.id))return false;
      if(node.kind&&!['prefecture','city','ward','special_ward','town','village','county','municipality','administrative'].includes(node.kind))return false;
      if(node.browseOnly&&node.type!=='行政区')return false;
      seen.add(node.id);return true;
    }).map(node=>node.label||node.name||node.nameJa||'').filter(Boolean).join(' › ');
  }
  function row(e){
    const isAdmin=admin(e),action=query?'data-result':'data-select';
    const meta=e.displayType||e.type||'地区';
    const subject=query?e.entity||e:e,preview=!isAdmin?summarize(subject):null;
    const note=meta+(isAdmin?'':` · ${hasDraft(e)?'有修改稿':(e.packageIds||[]).length?'已有正文空位':'可补写'}${e.coordinates?'':' · 坐标未收录'}`);
    const text=query?[subject.displayType||subject.type||meta,searchLocation(subject),summarize(subject,{selected:true}).text].filter(Boolean).join(' · '):preview?preview.text:note;
    return `<li class="lj-row ${e.id===selectedId?'selected':''}" data-entity-row="${esc(e.id)}"><button class="lj-namebutton" ${action}="${esc(e.id)}" title="${esc(query?text:note)}"><span class="lj-name">${esc(e.name||e.label)}</span><span class="lj-meta${preview?' lj-place-summary':''}">${esc(text)}</span></button>${e.hasChildren?`<button class="lj-enter" data-enter="${esc(e.id)}">下级 ›</button>`:''}${e.browseOnly?'':button('查看','browse-read',`data-id="${esc(e.id)}"`)}</li>`;
  }
  const pathAttribute=ids=>`data-path="${esc(JSON.stringify(ids))}"`;
  async function renderTree(ticket=request,listPage=null){
    if(!tree||(!desktop&&$('#regionDrawer')?.hidden))return;
    const treeTicket=++treeRequest,entityIds=draftEntityIds();
    const valid=()=>ticket===request&&treeTicket===treeRequest&&(desktop||!$('#regionDrawer')?.hidden);
    const walk=async(parentId,parentPath,depth)=>{
      if(!valid())return'';
      const key=JSON.stringify(parentPath),pageOffset=treeOffsets.get(key)||0;
      const page=listPage?.parentId===parentId&&listPage.pathKey===key&&listPage.page.offset===pageOffset?listPage.page:await catalog.browsePage(parentId,{offset:pageOffset,limit:48,entityIds,pathIds:parentPath});
      if(!valid())return'';
      let html='';
      for(const e of page.items){
        nodes.set(e.id,e);const childPath=[...parentPath,e.id],attrs=pathAttribute(childPath),open=expanded.has(e.id);
        html+=`<div class="lj-row" style="padding-left:calc(6px + ${depth} * var(--lj-tree-indent,13px))">${e.hasChildren?`<button class="lj-arrow" data-expand="${esc(e.id)}" ${attrs} aria-label="${open?'收起':'展开'}${esc(e.name||e.label)}" aria-expanded="${open}">${open?'⌄':'›'}</button>`:'<span class="lj-arrow"></span>'}<button class="lj-namebutton" data-tree-select="${esc(e.id)}" ${attrs}><span class="lj-name">${esc(e.name||e.label)}</span></button>${e.hasChildren?`<button class="lj-enter" data-enter="${esc(e.id)}" ${attrs}>下级</button>`:''}</div>`;
        if(e.hasChildren&&open&&!parentPath.includes(e.id))html+=await walk(e.id,childPath,depth+1);
      }
      if(page.offset||page.hasMore)html+=`<div class="lj-inline" style="padding-left:calc(6px + ${depth} * var(--lj-tree-indent,13px))">${page.offset?`<button class="lj-button" data-tree-prev="${esc(parentId)}" ${pathAttribute(parentPath)}>上一组</button>`:''}${page.hasMore?`<button class="lj-button" data-tree-next="${esc(parentId)}" ${pathAttribute(parentPath)}>更多下级 ›</button>`:''}</div>`;
      return html;
    };
    const html=await walk(top,[],0);if(valid()){tree.innerHTML=html;remember();}
  }
  function pathMarkup(path){return path.map((n,i)=>`<button class="lj-button" data-enter="${esc(n.id)}" ${pathAttribute(path.slice(0,i+1).map(e=>e.id))}>${esc(n.name||n.label||n.nameJa)}</button>`).join('<span>›</span>');}
  async function crumbs(ticket,resolvedPath=null){
    const path=resolvedPath||await catalog.navigationPath(current,{pathIds});if(ticket!==request)return;
    const html=[...(history.hasReturn()?[button('返回搜索结果','browse-search-back')]:[]),`<button class="lj-button" data-enter="${esc(top)}">地区</button>`,pathMarkup(path)].filter(Boolean).join('<span>›</span>');
    if(desktop){$('#loc10AdminHead').innerHTML='<b>地区目录</b>';$('#loc10ListHead').innerHTML=`<div class="lj-inline">${html}</div>`;}else{for(const node of $$('#regionCrumb,#regionDrawerCrumb'))node.innerHTML=html;}
  }
  // LJ-Q07: complete text-search pages share the scan cache while browsing keeps its own origin and scroll.
  const searchRegion=()=>catalog.regions?.().find(region=>region.code===ui.state.regionCode);
  const searchRegionName=()=>{const region=searchRegion();return region?.name||region?.label||region?.groupName||ui.state.regionCode;};
  function showError(error,ticket){if(ticket===request)list.innerHTML=`<div class="lj-empty">${esc(error.message)} ${button('重试','browse-retry')}</div>`;}
  async function showRows(found,ticket,result=null,page=null){
    if(ticket!==request)return;
    for(const e of found)nodes.set(e.id,e.entity?{...e.entity,hasChildren:e.hasChildren??e.entity.hasChildren}:e);
    if(page)offset=page.offset;
    list.innerHTML=found.map(row).join('')||`<div class="lj-empty">${result?'没有匹配的名称、原名、别名或类型。':'本层没有符合筛选的地点。'}</div>`;
    const node=result?searchRegion():known(current),codes=node?.regionCodes||[result?ui.state.regionCode:node?.regionCode];
    const missing=[...new Set(codes.filter(Boolean).map(code=>catalog.availability?.(code)).filter(value=>value?.available===false).map(value=>value.packageId))];
    if(missing.length)list.insertAdjacentHTML('afterbegin',`<div class="lj-empty">此地区的点位与地图资料尚未载入。${missing.map(id=>`<button class="lj-button primary" data-region-package="${esc(id)}">下载／载入资料</button>`).join('')}</div>`);
    if(result){
      offset=result.page*48;
      list.insertAdjacentHTML('afterbegin',`<div class="lj-page-note">${esc(searchRegionName())} · 名称、原名、别名、类型 · ${result.total} 项匹配 ${button('退出搜索','browse-search-clear')}</div>`);
      list.insertAdjacentHTML('beforeend',`<div class="lj-inline lj-browse-pages"><span>${result.total?offset+1:0}–${Math.min(offset+48,result.total)} / ${result.total}</span>${button('上一页','browse-search-prev',result.page>0?'':'disabled')}${button('下一页','browse-search-next',result.page+1<result.pages?'':'disabled')}</div>`);
    }else list.insertAdjacentHTML('beforeend',`<div class="lj-inline lj-browse-pages"><span>${page.total?offset+1:0}–${Math.min(offset+found.length,page.total)} / ${page.total}</span>${button('上一页','browse-prev',offset?'':'disabled')}${button('下一页','browse-next',page.hasMore?'':'disabled')}</div>`);
    if(selectedId)await showSelectedDetail(ticket);else emptyDetail();
    if(ticket!==request)return;
    if(restoreScroll!==null&&scroll){scroll.scrollTop=restoreScroll;restoreScroll=null;}
    await renderTree(ticket,page?{parentId:current,pathKey:JSON.stringify(pathIds),page}:null);if(ticket===request)remember();
  }
  async function showSearchPage(result,ticket){
    try{
      const page=Math.floor(offset/48);
      if(page!==result.page)result=await catalog.textSearchPage(result.queryId,{page,pageSize:48});
      await showRows(result.items,ticket,result);
    }catch(error){showError(error,ticket);}
  }
  async function render({cachedSearch=false,path=null}={}){
    if(!list)return;const ticket=++request;++relatedRequest;
    try{
      await initialize();if(ticket!==request)return;
      modifiedPackages=new Set(Object.values(ui.engine.normalizeTextOverrides(ui.bridge.store.read().livingJapanTextOverrides).records).map(r=>r.packageId));
      list.innerHTML='<div class="lj-empty">正在读取本层资料…</div>';
      await crumbs(ticket,path);if(ticket!==request)return;
      const entityIds=draftEntityIds();
      if(query){
        const key=JSON.stringify([query,ui.state.regionCode,entityIds]);
        if(cachedSearch&&completedSearch?.key===key){await showSearchPage(completedSearch.result,ticket);return;}
        completedSearch=null;
        list.innerHTML=`<div class="lj-empty">正在搜索${esc(searchRegionName())}…</div>`;
        await catalog.startTextSearch(query,{regionCode:ui.state.regionCode,entityIds,requestScope:'browse-search',pageSize:48,onUpdate(event){
          if(ticket!==request)return;
          if(event.type==='complete'){completedSearch={key,result:event.result};void showSearchPage(event.result,ticket);}
          else if(event.type==='error')showError(new Error(event.result.message),ticket);
        }});
        if(ticket===request)await renderTree(ticket);
      }else{
        catalog.cancelSearch?.('browse-search');
        const page=await catalog.browsePage(current,{offset,limit:48,entityIds,pathIds});
        await showRows(page.items,ticket,null,page);
      }
    }catch(error){showError(error,ticket);}
  }
  // LJ-REGION-RELATIONS-20261030: restore local administration and related navigation without replacing a newer detail.
  async function loadRelated(e){
    const ticket=++relatedRequest,selection=selectedId;
    if(!e||e.browseOnly||e.type==='行政区')return;
    try{
      const overture=(await catalog.loadIndex?.())?.runtimeSource?.kind==='overture'||Boolean(e.livingAreaRole);
      const rows=await catalog.related(e,overture?{}:{limit:7}),peers=overture?rows:chooseRelatedIntroductions(rows);
      await ui.bridge.session.ensureSummaries?.([e,...peers]);
      if(ticket!==relatedRequest||selection!==selectedId)return;
      const host=$('[data-browse-related]',root);if(!host)return;
      // LJ-RELATED-NAMES-20261101: keep related navigation as wrapping, name-only inline links.
      host.innerHTML=peers.length?`<p class="lj-related-links"><span class="lj-related-label">相关地点 ${peers.length} 个：</span>${peers.map(item=>`<button type="button" class="lj-related-name" data-browse-related-id="${esc(item.id)}">${esc(item.name)}</button>`).join('、<wbr>')}</p>`:'';
    }catch(error){if(ticket===relatedRequest)ui.notify(error.message,'error');}
  }
  // LJ-MATERIAL-PLACE-20261030: the existing detail bridges verified point tags and their material entries.
  function propertyMarkup(e){if(!ui.engine.data.materialLibrary)return'';const info=ui.materialEditor.placeInfo(e);return `<p class="lj-meta">适用地域：${esc(info.climateName)}</p><p class="lj-meta">已挂词条：${info.bindings.length?info.bindings.map(binding=>esc(binding.name)+(binding.enabled===false?'（暂停）':'')).join('；'):'暂无'}</p>`;}
  function detail(e,path){
    const childButton=e.hasChildren?`<button class="lj-button" data-enter="${esc(e.id)}" ${pathAttribute(path.map(n=>n.id))}>查看下级地点 ›</button>`:'';
    const ancestors=path.filter(n=>n.id!==e.id),location=ancestors.length?`<div class="lj-inline lj-meta">${pathMarkup(ancestors)}</div>`:'';
    if(e.browseOnly)return `<article class="lj-detail" data-browse-detail><h3>${esc(e.name||e.label)}</h3>${location}<p>${e.kind==='browse-unassigned'?'来源尚不能确认行政归属，点位和正文按原身份保留。':'按实际地点的包含关系浏览。'}</p>${childButton}</article>`;
    const ids=ui.reader.packageIds(e),canMap=navigationCoordinates(e)||catalog.district?.(e.id)||e.type==='行政区';
    return `<article class="lj-detail" data-browse-detail><h3>${esc(e.name||e.label)}</h3>${location}<p class="lj-place-summary">${esc(summarize(e).text)}</p><div class="lj-status">${e.type==='行政区'?'可按真实行政边界定位':e.coordinates?'已收录地图坐标':navigationCoordinates(e)?'可定位到此片区附近':'坐标尚未收录，仍可阅读和保存正文。'}</div>${propertyMarkup(e)}<section data-browse-related></section><div class="lj-body-list">${ids.map(id=>{const p=ui.engine.data.packages.find(x=>x.id===id);return button(p?.displayName||e.name,'browse-body',`data-package="${esc(id)}" data-id="${esc(e.id)}"`);}).join('')}</div><div class="lj-inline">${childButton}${button('地图定位','browse-map',`data-id="${esc(e.id)}" ${canMap?'':'disabled'}`)}${button(ids.length?'阅读／编辑':'查看正文','browse-read',`data-id="${esc(e.id)}"`)}${ui.engine.data.materialLibrary?button('词条属性','browse-properties',`data-id="${esc(e.id)}"`):''}${button('新增正文空位','browse-new',`data-id="${esc(e.id)}"`)}${button('追加名称','browse-append',`data-id="${esc(e.id)}"`)}</div></article>`;
  }
  async function showSelectedDetail(ticket=request,context=pathIds){
    const id=selectedId,e=known(id)||await resolveNode(id);if(!e)return;
    const path=await catalog.navigationPath(id,{pathIds:context});
    if(ticket!==request||id!==selectedId)return;
    if(desktop){$('#loc10DetailName').textContent=e.name||e.label;$('#loc10DetailKind').textContent=e.displayType||e.type||'地区';$('#loc10DetailBody').innerHTML=detail(e,path);}
    else{
      const scrollTop=scroll?.scrollTop,rowNode=$(`[data-entity-row="${CSS.escape(id)}"]`,list);
      list.querySelectorAll('[data-browse-detail]').forEach(node=>node.remove());
      if(rowNode)rowNode.insertAdjacentHTML('afterend',detail(e,path));
      if(scroll)scroll.scrollTop=scrollTop;
    }
    list.querySelectorAll('[data-entity-row]').forEach(n=>n.classList.toggle('selected',n.dataset.entityRow===id));
    loadRelated(e);
  }
  async function select(id,context=pathIds){
    await initialize();const ticket=++locateRequest;++relatedRequest;
    const e=await resolveNode(id);if(!e||ticket!==locateRequest)return;
    selectedId=e.id;remember();if(!e.browseOnly){ui.state.selected=e;ui.state.selectedId=e.id;}
    if(ticket!==locateRequest)return;
    await showSelectedDetail(request,context);
  }
  async function enter(id,startOffset=0,{closeReader=true,pathIds:context=pathIds}={}){
    await initialize();const ticket=++locateRequest;++relatedRequest;
    if(closeReader&&!(await ui.reader.close()))return false;
    if(ticket!==locateRequest)return false;
    stopPending();
    const e=await resolveNode(id);if(!e&&id!==top)return false;
    const path=await catalog.navigationPath(e?.id||id,{pathIds:context});
    if(ticket!==locateRequest)return false;
    if(e?.regionCode)ui.state.regionCode=e.regionCode;
    current=e?.id||id;pathIds=path.map(n=>n.id);offset=startOffset;query='';search.value='';restoreScroll=0;selectedId=null;
    for(const a of path)expanded.add(a.id);
    $('#regionDrawer')?.setAttribute('hidden','');await render({path});return ticket===locateRequest;
  }
  async function restore(snapshot){
    await initialize();++locateRequest;
    stopPending();
    if(!snapshot)snapshot={...ui.state.browser,query:'',scrollTop:0};
    ({current,offset,selectedId}=snapshot);pathIds=snapshot.pathIds||[];query=snapshot.query||'';search.value=query;restoreScroll=snapshot.scrollTop||0;
    if(modified)modified.checked=Boolean(snapshot.modified);
    if(snapshot.regionCode)ui.state.regionCode=snapshot.regionCode;
    await render({cachedSearch:true});if(selectedId)await select(selectedId);
  }
  async function followLocation(id,context=pathIds){
    await initialize();const ticket=++locateRequest;
    if(!(await ui.reader.close())||ticket!==locateRequest)return;
    stopPending();
    const results=query?{...snapshot(),selectedId:id}:null;
    const entity=await resolveNode(id);if(!entity||ticket!==locateRequest)return;
    const location=await catalog.browseLocation(entity,{pageSize:48,entityIds:draftEntityIds(),pathIds:context});
    if(ticket!==locateRequest||!locationFound(location))return;
    if(results)history.follow(results);
    if(await enter(location.parentId,location.offset,{closeReader:false,pathIds:location.pathIds}))await select(location.entryId,location.pathIds);
  }
  function locationFound(location){if(location.status==='found')return true;ui.notify(location.status==='filtered'?'此地点不在当前筛选结果中。':'此地点的目录归属尚未确认。');return false;}
  const root=$(desktop?'#ljLocationsPage':'[data-page-root="region"]');
  root?.addEventListener('click',async event=>{
    const n=event.target.closest('button');if(!n)return;
    try{
      if(n.disabled)return;
      const context=n.dataset.path?JSON.parse(n.dataset.path):pathIds;
      if(n.dataset.expand){const id=n.dataset.expand;if(expanded.has(id))expanded.delete(id);else expanded.add(id);await renderTree();}
      else if(n.dataset.treeNext||n.dataset.treePrev){const key=JSON.stringify(context);treeOffsets.set(key,Math.max(0,(treeOffsets.get(key)||0)+(n.dataset.treeNext?48:-48)));await renderTree();}
      else if(n.dataset.enter)await enter(n.dataset.enter,0,{pathIds:context});
      else if(n.dataset.result||n.dataset.treeSelect)await followLocation(n.dataset.result||n.dataset.treeSelect,context);
      else if(n.dataset.browseRelatedId)await locate(await resolveNode(n.dataset.browseRelatedId));
      else if(n.dataset.select)await select(n.dataset.select,context);
      else if(n.id==='openRegionDrawer'){$('#regionDrawer').hidden=false;await renderTree();}
      else if(n.id==='closeRegionDrawer')$('#regionDrawer').hidden=true;
      else if(n.dataset.action?.startsWith('browse-')){const action=n.dataset.action,e=n.dataset.id?await resolveNode(n.dataset.id):null;
        if(action==='browse-next'){offset+=48;restoreScroll=0;await render();}if(action==='browse-prev'){offset=Math.max(0,offset-48);restoreScroll=0;await render();}
        if(action==='browse-search-next'){offset+=48;restoreScroll=0;await render({cachedSearch:true});}if(action==='browse-search-prev'){offset=Math.max(0,offset-48);restoreScroll=0;await render({cachedSearch:true});}
        if(action==='browse-search-back'&&await ui.reader.close())await restore(history.back());
        if(action==='browse-search-clear'&&await ui.reader.close())await restore(history.clear());if(action==='browse-retry')await render();
        if(action==='browse-map'){await ui.selectEntity(e,{locate:true});await ui.showPage('map');}
        if(action==='browse-read')await ui.openReader(e);
        if(action==='browse-body')await ui.openReader(e,n.dataset.package);
        if(action==='browse-append')ui.append(e);
        if(action==='browse-properties')await ui.materialEditor.showPlace(e);
        if(action==='browse-new'){const id=await ui.reader.newSlot(e);if(id)await ui.openReader(e,id,true);}
      }
    }catch(error){ui.notify(error.message,'error');}
  });
  let timer,composing=false;
  const stopPending=()=>{++request;catalog.cancelSearch?.('browse-search');clearTimeout(timer);};
  const queryChanged=()=>{stopPending();timer=setTimeout(async()=>{
    try{await initialize();const next=search.value.trim();
      if(!next&&query){await restore(history.clear());return;}
      if(next&&!query)history.begin(snapshot());
      query=next;offset=0;restoreScroll=0;await render();
    }catch(error){ui.notify(error.message,'error');}
  },400);};
  search?.addEventListener('compositionstart',()=>{composing=true;stopPending();});
  search?.addEventListener('compositionend',()=>{composing=false;queryChanged();});
  search?.addEventListener('input',event=>{if(!composing&&!event.isComposing)queryChanged();});search?.setAttribute('placeholder','搜索地点、地区、原名、别名或类型');
  modified?.addEventListener('change',()=>{offset=0;restoreScroll=0;treeOffsets.clear();render();});
  async function locate(entity){
    await initialize();const ticket=++locateRequest;
    if(!entity||!(await ui.reader.close())||ticket!==locateRequest)return;
    stopPending();
    const location=await catalog.browseLocation(entity,{pageSize:48,pathIds});
    if(ticket!==locateRequest||!locationFound(location))return;
    if(modified)modified.checked=false;
    if(await enter(location.parentId,location.offset,{closeReader:false,pathIds:location.pathIds}))await select(location.entryId,location.pathIds);
  }
  return{render,locate};
}
