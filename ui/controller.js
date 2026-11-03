import { $, $$, esc, ask, status, applyTheme } from './dom.js';
import { createReader } from './reader.js';
import { mountBrowser } from './browse.js';
import { mountMaterials } from './materials.js';
import { mountSettings } from './settings.js';
import { mountDiagnostics } from './diagnostics.js';
import { mountMap } from './map.js';
import { mountGuide } from './guide.js';
import { createMaterialEditor } from './material-editor.js';
import { injectionName, qualifiedInjectionName } from '../src/injection-names.js';
import { mountUpdateIndicator } from './update-indicator.js';
import { createPlaceEditor } from './place-editor.js';
import { createPlaceMaterialNavigation } from './place-material-navigation.js';
import { isHiddenPlace, hiddenPlaceId } from '../src/place-hidden.js';

// LJ-EXT-VIEW: the approved three layouts share the same live state and operations.
const bridge=parent.LivingJapanBridge, layout=document.body.dataset.layout;
const pageIds={map:'ljMapPage',region:'ljLocationsPage',package:'ljPackagesPage',diagnostic:'ljDiagnosticsPage',settings:'ljSettingsPage'};
const pageLabels={'地图':'map','地点':'region','地区':'region','资料':'package','检查':'diagnostic','诊断':'diagnostic'};
// LJ-PAGE-NAV-SELECTION-20261102: all layouts expose the same current-page state, independent of hover and focus.
function renderPageNavigation(page){
  for(const button of $$('.nav7 button,.top .nav [data-go]')){
    const active=(button.dataset.go||pageLabels[button.textContent.trim()])===page;
    button.classList.toggle('on',active);button.classList.toggle('active',active);
    if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  }
}
let modules={}, refreshing=false, selectionRequest=0, readerRequest=0;
const ui={bridge,layout,state:bridge.state,esc,ask,notify:status,
  get engine(){return bridge.session.engine;},
  getEntityForPackage(id){
    const p=ui.engine.data.packages.find(x=>x.id===id);if(!p)return null;
    if(p.materialFragmentId)return {id:`fragment:${p.materialFragmentId}`,name:p.displayName,packageIds:[id],materialFragmentId:p.materialFragmentId,type:ui.engine.data.materialLibrary?.fragments[p.materialFragmentId]?.ownBody?'词条正文':'资料片段',adminPath:[],adminNodes:[]};
    const known=bridge.catalog.get(p.placeId);if(known)return known;
    const custom=Object.values(bridge.store.read().customSlots).find(s=>'LJ_USER_'+encodeURIComponent(s.id)===id);
    return {id:custom?.entityId||p.placeId||`package:${id}`,legacyPlaceId:p.placeId,name:custom?.name||p.displayName,packageIds:[id],adminPath:custom?.adminPath||[],adminNodes:custom?.adminNodes||[],coordinates:custom?.coordinates||null,regionCode:custom?.regionCode||null,type:custom?.type||p.channel||'资料'};
  },
  async showPage(page){
    page=({locations:'region',packages:'package',check:'diagnostic'})[page]||page;
    if(!pageIds[page])return false;
    if(!(await ui.reader.close()))return false;
    if(ui.state.page==='settings'&&page!=='settings'&&modules.settings.requestLeave&&!(await modules.settings.requestLeave()))return false;
    ui.placeEditor?.suspend();ui.state.page=page;
    if(layout==='desktop')for(const [key,id]of Object.entries(pageIds))$('#'+id).hidden=key!==page;
    else{$$('[data-page-root]').forEach(n=>{const active=n.dataset.pageRoot===page;n.hidden=!active;n.classList.toggle('active',active);});$$('[data-go]').forEach(n=>n.classList.toggle('active',n.dataset.go===page));}
    renderPageNavigation(page);
    await modules[page]?.render?.();modules.map?.renderBrandControl();ui.placeEditor?.render();return true;
  },
  async locateMaterial(entity,packageId,editing=false){const view=ui.reader.viewState();if(editing)view.mode='edit';ui.reader.suspend();if(await modules.package.locate(packageId))await ui.reader.open(entity,packageId,editing,view);},
  async locateMaterialNode(id){return modules.package.locate(id);},
  async locateRegion(entity,packageId,editing=false){const view=ui.reader.viewState();if(editing)view.mode='edit';const located=await bridge.catalog.resolve(entity.id,{regionCode:entity.regionCode||ui.state.regionCode})||entity;ui.reader.suspend();if(!(await ui.showPage('region')))return;await modules.region.locate(located);await ui.reader.open(located,packageId,editing,view);},
  async openSettings(tab='reading',channel){if(ui.state.page!=='settings'&&!(await ui.showPage('settings')))return false;modules.settings.openTab(tab,channel);return true;},
  async selectEntity(entity,options={}){const ticket=++selectionRequest;if(!entity)return;if(entity.canonicalIndexOnly)entity=await bridge.catalog.resolve(entity.id,{regionCode:entity.regionCode})||entity;await bridge.session.ensureSummaries?.([entity]);if(ticket!==selectionRequest)return;ui.state.selected=entity;ui.state.selectedId=entity.id;await modules.map?.select?.(entity,options);},
  async openReader(entity,packageId,editing=false){const ticket=++readerRequest;if(!entity&&packageId)entity=ui.getEntityForPackage(packageId);if(entity?.canonicalIndexOnly)entity=await bridge.catalog.resolve(entity.id,{regionCode:entity.regionCode})||entity;if(ticket!==readerRequest)return false;return entity?ui.reader.open(entity,packageId,editing):false;},
  append(entity){
    const name=injectionName(entity,ui.engine.data);if(!name)return;
    const label=qualifiedInjectionName(entity,ui.engine.data,name),result=bridge.append(label);
    const message=label===name&&entity?.type!=='行政区'?'名称已追加，未附带行政区':'名称已追加到输入框';
    ui.notify(result?.ok?message:result?.error||'没有找到聊天输入框',result?.ok?'':'error');return result;
  },
  async beginPositionPick(position){await modules.map.beginPositionPick(position);},
  async locateSavedPlace(id){const entity=await bridge.catalog.resolve(id,{regionCode:ui.state.regionCode});if(!entity)return;if(!(await ui.showPage('region')))return;await modules.region.locate(entity);},
  async setPlaceHidden(entity,value){await bridge.store.update(data=>{data.livingJapanSettings||={};const ids=data.livingJapanSettings.hiddenPlaceIds||[];data.livingJapanSettings.hiddenPlaceIds=value?[...new Set([...ids,hiddenPlaceId(entity,ui.engine.data)])]:ids.filter(id=>!isHiddenPlace(entity,[id],ui.engine.data));});await ui.refresh();},
  async refresh(){if(refreshing)return;refreshing=true;try{await bridge.session.refresh();renderTools();await modules[ui.state.page]?.render?.();ui.placeEditor?.render();}finally{refreshing=false;}},
};
Object.assign(ui,createPlaceMaterialNavigation(ui));
ui.reader=createReader(ui);
ui.materialEditor=createMaterialEditor(ui);
ui.placeEditor=createPlaceEditor(ui);
// LJ-APPROVED-WINDOW-CLOSE-20261030: connect the confirmed narrow × control to the real leave-aware close.
for(const button of $$('.top .win button[aria-label="关闭说明"]')){button.dataset.windowClose='true';button.title='关闭';button.setAttribute('aria-label','关闭');}
// LJ-WINDOW-GRIP-20261102: reserve a visible drag target on every movable page header.
const unmountWindowDrags=layout==='mobile'?[]:$$('.top7,.top').map(header=>{
  const grip=document.createElement('span');grip.dataset.windowGrip='true';grip.title='按住此处拖动窗口';grip.setAttribute('aria-label',grip.title);
  grip.innerHTML='<svg viewBox="0 0 12 20" aria-hidden="true"><circle cx="3" cy="4" r="1.5"/><circle cx="9" cy="4" r="1.5"/><circle cx="3" cy="10" r="1.5"/><circle cx="9" cy="10" r="1.5"/><circle cx="3" cy="16" r="1.5"/><circle cx="9" cy="16" r="1.5"/></svg>';
  header.prepend(grip);return bridge.mountWindowDrag(header);
});
modules.region=mountBrowser(ui);modules.package=mountMaterials(ui);modules.settings=mountSettings(ui);modules.diagnostic=mountDiagnostics(ui);modules.map=mountMap(ui);
ui.guide=mountGuide(ui,{settings:modules.settings});
ui.updateIndicator=mountUpdateIndicator(ui);
function renderTools(){
  const data=bridge.store.read(),settings=ui.engine.normalizeSettings(data.livingJapanSettings),prefs=data.extensionUi||{};
  applyTheme(prefs.theme||'auto');
  for(const n of $$('.auto-scan7,#autoScanToggle,[data-action="master-toggle"]')){n.setAttribute('aria-pressed',String(settings.masterEnabled!==false));n.classList.toggle('on',settings.masterEnabled!==false);}
  const pinned=(prefs.pinned??data.livingJapanUIPreferences?.panelPinned)!==false;
  for(const n of $$('#lockButton,.tools7 button[title^="锁定界面"]')){n.setAttribute('aria-pressed',String(pinned));n.classList.toggle('active',pinned);n.classList.toggle('on',pinned);}
}
async function savePreference(key,value){await bridge.store.update(data=>{data.extensionUi={...data.extensionUi,[key]:value};return data;});renderTools();}
document.addEventListener('click',async event=>{
  const n=event.target.closest('button');if(!n)return;
  try{
    if(n.dataset.regionPackage){await bridge.openPackages({focusId:n.dataset.regionPackage});return;}
    if(n.dataset.go&&n.dataset.go!=='fullmap'){await ui.showPage(n.dataset.go);return;}
    if(n.closest('.nav7')){const page=pageLabels[n.textContent.trim()];if(page)await ui.showPage(page);return;}
    const title=n.getAttribute('title')||'';
    if(n.id==='settingsButton'||(n.closest('.tools7')&&title==='设置'))await ui.showPage('settings');
    if(n.id==='themeButton'||title.startsWith('切换明暗')){const current=document.body.dataset.theme;await savePreference('theme',current==='night'?'day':'night');}
    if(n.id==='lockButton'||title.startsWith('锁定界面')){const data=bridge.store.read();await savePreference('pinned',(data.extensionUi?.pinned??data.livingJapanUIPreferences?.panelPinned)===false);}
    if(n.dataset.windowClose||title==='关闭')await bridge.close();
    if(title.startsWith('切换横版'))await bridge.setLayout(layout==='desktop'?'portrait':'desktop');
    if(title==='切换到横版')await bridge.setLayout('desktop');
    if(n.matches('.auto-scan7,#autoScanToggle,[data-action="master-toggle"]')){const settings=ui.engine.normalizeSettings(bridge.store.read().livingJapanSettings);settings.masterEnabled=!settings.masterEnabled;await bridge.session.runtime.saveSettings(settings);ui.notify(settings.masterEnabled?'自动提示注入已开启':'自动提示注入已暂停');renderTools();}
  }catch(error){ui.notify(error.message,'error');}
});
document.addEventListener('living-japan-settings-tab',event=>{ui.openSettings(event.detail?.tab||event.detail||'reading',event.detail?.channel).catch(error=>ui.notify(error.message,'error'));});
const unsubscribe=bridge.subscribe(()=>{renderTools();if(['diagnostic','map'].includes(ui.state.page))modules[ui.state.page]?.render?.();});
globalThis.LivingJapanView={ui,modules,async leave(){if(!(await ui.reader.close())||!(await ui.placeEditor.requestLeave()))return false;return modules.settings.requestLeave?modules.settings.requestLeave():true;},async prepareLayoutChange(){if(!(await ui.reader.close()))return false;if(modules.settings.requestLeave&&!(await modules.settings.requestLeave()))return false;ui.placeEditor.suspend();return true;}};
window.addEventListener('unload',()=>{unsubscribe();unmountWindowDrags.forEach(unmount=>unmount());ui.guide.destroy();ui.updateIndicator.destroy();modules.map?.destroy?.();},{once:true});
try{renderTools();await ui.showPage(ui.state.page||'map');$('#ljLoading').remove();ui.guide.offer().catch(error=>ui.notify(error.message,'error'));}catch(error){$('#ljLoading').textContent=`资料读取失败：${error.message}`;console.error(error);}
