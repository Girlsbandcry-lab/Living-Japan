import { DEMO_IDS } from '../src/workflow-demo-data.js';
import { materialCategoryNodeId, materialOwnFragmentId, materialPackageId } from '../src/material-library.js';

export async function waitForWorkflow(test, message = '等待演示界面', timeout = 10000) {
  const start=Date.now();let value;
  while(!(value=await test())) {if(Date.now()-start>timeout)throw new Error(message+'：界面未就绪');await new Promise(resolve=>setTimeout(resolve,30));}
  return value;
}
export const WORKFLOW_ACTIONS = Object.freeze(['host.chat','host.quickMenu','host.quickMode','map.search','map.select','map.origin','map.destination','map.travel','map.depart','map.append','browse.locate','browse.children','browse.parent','browse.favorite','browse.hidden','place.read','place.open','place.fill','place.pick','place.confirmPosition','place.save','bindings.open','bindings.add','bindings.choose','bindings.complete','bindings.preview','bindings.edit','material.reader','material.edit','material.save','material.returnPlace','material.keywords','material.addCategory','conditions.open','conditions.fill','conditions.save','settings.open','settings.set','settings.save','diagnostic.preview','diagnostic.show','diagnostic.openResult','diagnostic.openSettings','illustration']);
export function createWorkflowDriver({bridge,getView,hostDocument,context,showIllustration=()=>{}}) {
  let lastNewId=null,lastMaterial='wood';
  const view=()=>getView(),ui=()=>view().ui,doc=()=>view().uiDocument||view().ui?.document||hostDocument.querySelector('#living-japan-shell iframe').contentDocument;
  const visible=node=>node&&!node.hidden&&!node.closest('[hidden]')&&node.getClientRects().length;
  const find=(selector,owner=doc())=>[...owner.querySelectorAll(selector)].find(visible);
  const target=async(selector,owner=doc())=>waitForWorkflow(()=>find(selector,owner),'找不到 '+selector);
  const click=async(selector,{owner=doc(),after}={})=>{const node=await waitForWorkflow(()=>{const found=find(selector,owner);return found&&!found.disabled?found:null;},'等待演示按钮 '+selector);node.click();if(after)await waitForWorkflow(after,'等待操作结果');return node;};
  const field=async(selector,value,owner=doc())=>{const node=await target(selector,owner);if(node.type==='checkbox')node.checked=Boolean(value);else node.value=Array.isArray(value)?value.join('\n'):String(value??'');node.dispatchEvent(new owner.defaultView.Event('input',{bubbles:true}));node.dispatchEvent(new owner.defaultView.Event('change',{bubbles:true}));return node;};
  const entity=async name=>{const id=name==='new'?lastNewId:DEMO_IDS[name]||name;if(!id)throw new Error('本章尚未创建新地点');return await bridge.catalog.resolve(id,{regionCode:'13'})||bridge.catalog.get(id)||bridge.index?.adminNodes?.find(row=>row.id===id);};
  const material=name=>DEMO_IDS[name]||name||DEMO_IDS[lastMaterial];
  const packageId=name=>materialPackageId(materialOwnFragmentId(material(name)));
  const page=async value=>{if(ui().state.page!==value&&!(await ui().showPage(value)))throw new Error('演示未能进入'+value);};
  async function locate(name='cafe'){const item=await entity(name);if(!item)throw new Error('没有示例地点 '+name);await page('region');await view().modules.region.locate(item);return item;}
  async function readMaterial(name=lastMaterial,editing=false){lastMaterial=name;const id=packageId(name);await ui().locateMaterialNode(materialCategoryNodeId(material(name)));await ui().openReader(null,id,editing);return target('.lj-reader-overlay');}
  async function modalField(name,value){const selector=`dialog[open] [name="${name}"]`;const nodes=[...doc().querySelectorAll(selector)];if(!nodes.length)throw new Error('表单缺少 '+name);if(nodes[0].type==='checkbox'){for(const node of nodes){node.checked=Array.isArray(value)?value.map(String).includes(node.value):Boolean(value);node.dispatchEvent(new (doc().defaultView.Event)('change',{bubbles:true}));}}else await field(selector,value);}
  async function saveDialog(){const old=bridge.store.read().revision;const modal=await target('dialog[open]');await click('dialog[open] [data-choice="save"]');await waitForWorkflow(()=>bridge.store.read().revision>old&&!modal.isConnected,'保存演示表单');}
  async function settingsSet(p){
    if(p.scope==='reading'){await field(`[data-settings-reading="${p.key}"]`,p.value);return target(`[data-settings-reading="${p.key}"]`);}
    if(p.scope==='common'){const node=await target(`[data-settings-common="${p.key}"]`);if(node.tagName==='SELECT')return field(`[data-settings-common="${p.key}"]`,p.value);if((node.getAttribute('aria-pressed')==='true')!==Boolean(p.value)){const revision=bridge.store.read().revision;node.click();await waitForWorkflow(()=>bridge.store.read().revision>revision,'保存示例开关');}return target(`[data-settings-common="${p.key}"]`);}
    if(p.scope==='quota'){
      await ui().openSettings('favorites');
      await click('[data-place-category-mode="introductions"]');
      const search=await target('[data-map-point-search]');await field('[data-map-point-search]','咖啡');
      const quota=await target(`[data-peer-place-quota="${p.key}"]`);const revision=bridge.store.read().revision;await field(`[data-peer-place-quota="${p.key}"]`,p.value);quota.dispatchEvent(new (doc().defaultView.Event)('blur',{bubbles:true}));await waitForWorkflow(()=>bridge.store.read().revision>revision,'保存同级数量');return target(`[data-peer-place-quota="${p.key}"]`);
    }
    if(p.scope==='map'){await click('[data-place-category-mode="map"]');await field('[data-map-point-search]','咖啡');const selector=`[data-map-point-category="${p.key}"]`;const node=await target(selector);if((node.getAttribute('aria-pressed')==='true')!==Boolean(p.value)){const revision=bridge.store.read().revision;node.click();await waitForWorkflow(()=>bridge.store.read().revision>revision,'保存示例地图分类');}return target(selector);}
    if(p.scope==='favorite'){
      const item=await entity(p.entity||'cafe');await ui().selectEntity(item);await ui().openSettings('favorites');const index=p.index||0;
      await click(`[data-settings-action="favorite-current"][data-index="${index}"]`);
      await field(`[data-favorite-index="${index}"][data-favorite-field="displayName"]`,p.label||'木窗');
      if(p.save){const revision=bridge.store.read().revision;await click('[data-settings-action="save-favorites"]',{after:()=>bridge.store.read().revision>revision});}
      return target(`[data-favorite-index="${index}"]`);
    }
    throw new Error('未知设置示范：'+p.scope);
  }
  async function perform(step){
    const p=step.params||{},action=step.action;showIllustration(null);
    if(!['host.quickMenu','host.quickMode'].includes(action))hostDocument.body.dispatchEvent(new hostDocument.defaultView.Event('pointerdown',{bubbles:true}));
    let anchor;
    if(action==='host.chat'){const input=hostDocument.getElementById('send_textarea');input.value=p.text||'';context.chat=[{is_user:true,mes:input.value}];input.dispatchEvent(new hostDocument.defaultView.Event('input',{bubbles:true}));anchor=input;}
    else if(action==='host.quickMenu'){bridge.guideHost.openQuickMenu();anchor=await target('#living-japan-floating-menu',hostDocument);}
    else if(action==='host.quickMode'){bridge.guideHost.openQuickMenu();const revision=bridge.store.read().revision;const mode=p.mode;await click(`[data-wrapper-mode="${mode}"],[data-setting-wrapper="${mode}"],[data-entry-wrapper="${mode}"]`,{owner:hostDocument});await waitForWorkflow(()=>bridge.store.read().livingJapanSettings.wrapperMode===mode,'切换示例强度');anchor=await target('#living-japan-floating-menu',hostDocument);}
    else if(action==='map.search'){await page('map');await field('[data-map-query]',p.query);await waitForWorkflow(()=>find('[data-lj-map="search-choose"]'),'搜索示例地点');anchor=await target('[data-map-results]');}
    else if(action==='map.select'){await page('map');const item=await entity(p.entity||'cafe');const choice=find(`[data-lj-map="search-choose"][data-map-entity="${item.id}"]`);if(choice){choice.click();await waitForWorkflow(()=>ui().state.selectedId===item.id&&!find('[data-lj-map="search-choose"]'),'选中搜索地点');}else{if(find('[data-map-query]')?.value)await field('[data-map-query]','');await ui().selectEntity(item,{locate:true});}anchor=await target('[data-map-title]');}
    else if(action==='map.origin'||action==='map.destination'){const kind=action.split('.')[1],selectedId=ui().state.selectedId,key=kind==='origin'?'routeOrigin':'routeDestination';await click(`[data-lj-map="${kind}"]:not([data-map-entity])`,{after:()=>ui().state[key]?.id===selectedId});anchor=await target('[data-lj-map="depart"]');}
    else if(action==='map.append'||action==='map.depart'){const input=hostDocument.getElementById('send_textarea'),before=input.value;if(action==='map.append'){const button=find('[data-lj-map="append"]:not([data-map-entity])');if(button)button.click();else{const title=await target('[data-map-title]');title.dispatchEvent(new (doc().defaultView.MouseEvent)('dblclick',{bubbles:true}));}}else await click('[data-lj-map="depart"]');await waitForWorkflow(()=>input.value!==before,'追加示例聊天');context.chat=[{is_user:true,mes:input.value}];anchor=input;}
    else if(action==='map.travel'){const mode=p.mode==='walk'?'walking':p.mode;await click(`[data-lj-map="travel"][data-map-travel="${mode}"]`);anchor=await waitForWorkflow(()=>{const node=find('[data-lj-map="depart"]');return node&&!node.disabled?node:null;},'等待出行估算');}
    else if(action==='browse.locate'){await locate(p.entity);anchor=await target('[data-browse-detail]');}
    else if(action==='browse.children'){await locate(p.entity||'hall');const id=(await entity(p.entity||'hall')).id;await click(`[data-enter="${id}"]`);anchor=await target('#loc10List,#regionList');}
    else if(action==='browse.parent'){await locate('hall');anchor=await target('#regionCrumb,#loc10ListHead');}
    else if(action==='browse.favorite'||action==='browse.hidden'){const item=await locate(p.entity);const selector=`[data-action="${action.replace('.','-')}"][data-id="${item.id}"]`;const node=await target(selector);if((node.getAttribute('aria-pressed')==='true')!==Boolean(p.value)){const revision=bridge.store.read().revision;node.click();await waitForWorkflow(()=>bridge.store.read().revision>revision,'保存示例地点设置');}anchor=await target(selector);}
    else if(action==='place.read'){const item=await locate(p.entity);await ui().openReader(item);anchor=await target('.lj-reader-overlay');}
    else if(action==='place.open'){if(p.isNew){await page('region');await ui().placeEditor.open(null,{isNew:true,parentId:DEMO_IDS.city,tab:p.tab||'data'});lastNewId=ui().state.placeEditor.id;}else await ui().placeEditor.open(await entity(p.entity||'cafe'),{tab:p.tab||'data'});anchor=await target('.lj-place-editor');}
    else if(action==='place.fill'){
      for(const [key,value]of Object.entries(p.fields||{})){if(key==='body'){if(ui().state.placeEditor.tab!=='text')await click('[data-place-edit="tab"][data-tab="text"]');await field('[data-place-body]',value);}else{const textFields=['summary'];if(textFields.includes(key)&&ui().state.placeEditor.tab!=='text')await click('[data-place-edit="tab"][data-tab="text"]');await field(`[data-place-field="${key}"]`,value);}}
      if(p.type){const select=await target('[data-place-type]');const option=[...select.options].find(row=>row.value===p.type||row.textContent.includes(p.type)||p.type==='in.food.cafe'&&/咖啡/.test(row.textContent));if(!option)throw new Error('没有示例类型 '+p.type);await field('[data-place-type]',option.value);}
      if(p.parent){const parent=await entity(p.parent);await field('[data-place-parent-query]',parent.name||parent.label);await click('[data-place-edit="parent-search"]');await click(`[data-place-edit="parent"][data-id="${parent.id}"]`);}
      anchor=await target('.lj-place-content');
    }
    else if(action==='place.pick'){await click('[data-place-edit="pick"]',{after:()=>Boolean(ui().state.placeEditor?.picker)});anchor=await target('[data-position-picker]');}
    else if(action==='place.confirmPosition'){
      if(!ui().state.placeEditor?.picker)throw new Error('演示未进入地图选点');
      await view().modules.map.render();
      const canvas=await target('canvas[aria-label^="Living Japan 地图"]'),rect=canvas.getBoundingClientRect(),mapView=ui().state.mapView,projection=bridge.catalog.projection();
      const clientX=rect.left+rect.width/2+(p.longitude*projection.xScale+projection.xOffset-mapView.center[0])*mapView.scale;
      const clientY=rect.top+rect.height/2+(p.latitude*projection.yScale+projection.yOffset-mapView.center[1])*mapView.scale;
      if(clientX<rect.left||clientX>rect.right||clientY<rect.top||clientY>rect.bottom)throw new Error('示例选点不在当前地图内');
      const ownedCapture=Object.getOwnPropertyDescriptor(canvas,'setPointerCapture'),ownedRelease=Object.getOwnPropertyDescriptor(canvas,'releasePointerCapture');
      try{
        // Synthetic pointers have no browser capture; the real map pointer handlers still perform the pick.
        canvas.setPointerCapture=()=>{};canvas.releasePointerCapture=()=>{};
        for(const type of ['pointerdown','pointerup'])canvas.dispatchEvent(new (doc().defaultView.PointerEvent)(type,{bubbles:true,pointerId:71,pointerType:'mouse',clientX,clientY,button:0,buttons:type==='pointerdown'?1:0}));
      }finally{for(const [name,descriptor]of [['setPointerCapture',ownedCapture],['releasePointerCapture',ownedRelease]]){if(descriptor)Object.defineProperty(canvas,name,descriptor);else delete canvas[name];}}
      await waitForWorkflow(()=>Boolean(ui().state.placeEditor?.picker?.candidate),'在示例地图选点');
      await click('[data-lj-map="pick-confirm"]',{after:()=>!ui().state.placeEditor?.picker});anchor=await target('.lj-place-editor');
    }
    else if(action==='place.save'){if(find('[data-pm-action="back-preview"]'))await click('[data-pm-action="back-preview"]');const revision=bridge.store.read().revision;await click('[data-place-edit="save"]',{after:()=>bridge.store.read().revision>revision&&!ui().state.placeEditor});anchor=await target('[data-browse-detail]');}
    else if(action==='bindings.open'){await click('[data-place-edit="tab"][data-tab="bindings"]');anchor=await target('.lj-material-toolbar');}
    else if(action==='bindings.add'){await click('[data-pm-action="add"]');anchor=await target('[data-pm-query]');}
    else if(action==='bindings.choose'){const id=material(p.material),name=ui().engine.data.materialLibrary.categories[id].name;await field('[data-pm-query]',name);await click(`[data-pm-choice="${id}"]`);anchor=await target(`[data-pm-choice="${id}"]`);}
    else if(action==='bindings.complete'){await click('[data-pm-action="complete"]');anchor=await target('.lj-material-toolbar');}
    else if(action==='bindings.preview'){lastMaterial=p.material||lastMaterial;if(find('[data-pm-action="back-preview"]'))await click('[data-pm-action="back-preview"]');await click(`[data-pm-action="preview"][data-id="${material(lastMaterial)}"]`,{after:()=>Boolean(find('[data-pm-action="edit-material"]'))});anchor=await target('.lj-material-preview-title,.lj-material-preview');}
    else if(action==='bindings.edit'){await click('[data-pm-action="edit-material"]',{after:()=>Boolean(find('.lj-reader-overlay textarea'))});anchor=await target('.lj-reader-overlay');}
    else if(action==='material.reader')anchor=await readMaterial(p.material);
    else if(action==='material.edit'){await click('[data-reader="edit"]');anchor=await target('.lj-reader-overlay textarea');}
    else if(action==='material.save'){if(!find('.lj-reader-overlay textarea'))await click('[data-reader="edit"]');await field('.lj-reader-overlay textarea',p.text);const revision=bridge.store.read().revision;await click('[data-reader="save"]',{after:()=>bridge.store.read().revision>revision&&!ui().reader.isDirty()&&!find('[data-reader-state]')?.textContent.includes('正在保存')});anchor=await target('.lj-reader-overlay');}
    else if(action==='material.returnPlace'){await click('[data-reader="return-place"],[data-material-action="return-place"]',{after:()=>ui().state.page==='region'&&Boolean(find('.lj-place-editor'))});anchor=await target('.lj-place-editor');}
    else if(action==='material.keywords'){void ui().materialEditor.editKeywords(material(lastMaterial));await target('dialog[open] [name="activationKeywords"]');await modalField('activationKeywords',p.keywords||[]);await saveDialog();anchor=await target('.lj-reader-overlay');}
    else if(action==='material.addCategory'){await ui().locateMaterialNode('layer:IN');await click('[data-material-action="add"]');await click('dialog[open] [data-choice="category"]');await modalField('name',p.name||'窗边座位');await saveDialog();anchor=await target('#pkg10Roots,#packageRoots');}
    else if(action==='conditions.open'){const info=await target('[data-reader-info]');info.open=true;await click('[data-reader="conditions"]');anchor=await target('dialog[open].lj-condition-dialog');}
    else if(action==='conditions.fill'){for(const [key,value]of Object.entries(p))await modalField(key,key==='regionId'&&value==='unrestricted'?'@any':value);anchor=await target('dialog[open].lj-condition-dialog');}
    else if(action==='conditions.save'){await saveDialog();anchor=await target('.lj-reader-overlay');}
    else if(action==='settings.open'){await ui().openSettings(p.tab||'common');anchor=await target('#set12Content,#settingsScroll');}
    else if(action==='settings.set')anchor=await settingsSet(p);
    else if(action==='settings.save'){const revision=bridge.store.read().revision;await click(`[data-settings-action="save-${p.scope}"]`,{after:()=>bridge.store.read().revision>revision});anchor=await target('#set12Content,#settingsScroll');}
    else if(action==='diagnostic.preview'){await page('diagnostic');const prior=bridge.session.runtime.getLastPreview();await click('[data-lj-diag-action="preview"]',{after:()=>bridge.session.runtime.getLastPreview()?.completedAt!==prior?.completedAt});await click(`[data-lj-diag-tab="${p.tab||'results'}"]`);anchor=await target('.lj-diagnostic-reading-summary,[data-lj-diag-tab="prompt"]');}
    else if(action==='diagnostic.show'){await click(`[data-lj-diag-tab="${p.tab}"]`);anchor=await target('[data-lj-diag-tab][aria-pressed="true"]');}
    else if(action==='diagnostic.openResult'){const id=packageId(p.material||lastMaterial);const node=find(`[data-lj-diag-package="${id}"]`);if(!node)throw new Error('预览结果没有对应示例正文');node.click();anchor=await target('.lj-reader-overlay');}
    else if(action==='diagnostic.openSettings'){await click(`[data-lj-diag-settings="${p.channel}"]`);anchor=await target(`#lj-channel-${p.channel}`);}
    else if(action==='illustration'){showIllustration(p);return {surface:'illustration',target:null};}
    else throw new Error('未知导览步骤：'+action);
    if(step.target){const owner=step.surface==='host'?hostDocument:doc();anchor=find(step.target,owner)||anchor;}
    if(anchor?.isConnected)anchor.scrollIntoView({block:'nearest',inline:'nearest'});
    return {target:anchor,surface:anchor?.ownerDocument===hostDocument?'host':'workspace'};
  }
  return {perform,find,target,getLastNewId:()=>lastNewId};
}
