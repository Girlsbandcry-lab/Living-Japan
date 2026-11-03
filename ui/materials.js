import { packageDisplayName } from '../src/place-metadata.js';
import { MATERIAL_LAYER_LABELS } from '../src/material-catalog.js';
import { isPlaceBodyPackage, materialGroupId, materialLayerGroupId, materialRegionGroupId, materialCategoryNodeId, materialRegionPath, materialRegionRows } from '../src/material-library.js';
import { canonicalPlaceContext, placeParentContexts } from '../src/place-identities.js';
import { normalizeSearchText, tokenizeSearchQuery, prepareSearchFields, matchesPreparedSearchFields } from '../src/search-text.js';

// LJ-EXT-MATERIALS
const layerNames = { TN: '时间与自然', EX: '外部地域', IN: '内部场所', EV: '明确场景' };
const copy = value => JSON.parse(JSON.stringify(value));
// LJ-MATERIAL-SEARCH-Q08: metadata-only fields and query results belong to this material model, never to activation rules.
const nameFields = row => row ? [row.name, row.label, row.displayName, row.nameJa, row.shortName, row.originalName, row.activationName,
  ...(row.originalNames || []), ...(row.fullNames || []), ...(row.aliases || []), ...(row.searchAliases || []), ...(row.chainSearchOnlyNames || [])] : [];

export function buildMaterialsModel(engine) {
  const data = engine.data, nodes = new Map(), packageNodes = new Map();
  const library = data.materialLibrary;
  const controls = new Map(data.controlGroups.map(group => [group.controlGroupId, group]));
  const places = new Map(data.places.map(place => [place.placeId, place]));
  const parentNames = entity => {
    const fields = [], seen = new Set(), pending = placeParentContexts(entity, data);
    while (pending.length) {
      const parent = pending.pop();
      if (seen.has(parent.id)) continue;
      seen.add(parent.id); fields.push(...nameFields(parent));
      pending.push(...placeParentContexts(parent, data));
    }
    return fields;
  };
  const register = node => { nodes.set(node.id, node); return node; };
  const roots = data.layerOrder.map(layer => register({ id: 'layer:' + layer, name: library ? MATERIAL_LAYER_LABELS[layer] : layerNames[layer], layer, kind: 'layer', type: '资料层', parentId: null, children: [], control: { kind: 'group', id: materialLayerGroupId(layer) }, terms: [layerNames[layer]] }));
  // LJ-MATERIAL-NAV-20261030: empty terms and regional weather paths share the approved list controls.
  if (library) {
    for (const region of materialRegionRows(library)) {
      register({ id: 'material-region:' + region.id, name: region.name, layer: 'TN', regionId: region.id, kind: 'material-region', type: '适用地域', parentId: region.parentId && region.parentId !== 'jp' ? 'material-region:' + region.parentId : 'layer:TN', children: [], control: { kind: 'group', id: materialRegionGroupId(region.id) }, terms: nameFields(region) });
    }
    for (const category of Object.values(library.categories)) {
      const regionIds = category.layer === 'TN' ? materialRegionRows(library).map(region => region.id) : [''];
      for (const regionId of regionIds) register({ id: materialCategoryNodeId(category.id, regionId), name: category.name, layer: category.layer, categoryId: category.id, regionId, kind: 'material-category', type: '分类词条', parentId: category.parentId ? materialCategoryNodeId(category.parentId, regionId) : regionId ? 'material-region:' + regionId : 'layer:' + category.layer, children: [], control: { kind: 'group', id: materialGroupId(category.id, regionId) }, terms: nameFields(category) });
    }
  }
  for (const group of data.controlGroups.filter(group => group.kind === 'administrative')) {
    const admin = data.adminNodes.find(node => node.id === group.adminNodeId) || {};
    register({ id: 'admin:' + group.controlGroupId, name: group.label, layer: group.layer, kind: 'administrative', type: '行政分支', parentId: group.parentControlGroupId ? 'admin:' + group.parentControlGroupId : 'layer:' + group.layer, children: [], control: { kind: 'group', id: group.controlGroupId }, terms: [group.label, admin.nameJa, ...((data.placeNameAliases?.administrativeNames || {})[group.label] || []), ...((data.placeNameAliases?.administrativeNames || {})[admin.nameJa] || [])] });
  }
  for (const item of data.packages) {
    if (item.materialAnchor) continue;
    if (item.materialFragmentId && library) {
      const fragment = library.fragments[item.materialFragmentId];
      if (!fragment) continue;
      const category = library.categories[fragment.categoryId];
      // A term owns a body and a branch independently, without a duplicate child row.
      if (fragment.ownBody) {
        const node = nodes.get(materialCategoryNodeId(fragment.categoryId, category?.layer === 'TN' ? fragment.regionId : ''));
        if (node) {
          Object.assign(node, { packageId: item.id, package: item, fragmentId: fragment.id, bodyRegionId: fragment.regionId });
          packageNodes.set(item.id, node);
        }
        continue;
      }
      const node = register({ id: 'package:' + item.id, name: fragment.title, layer: item.layer, kind: 'package', type: '资料片段', parentId: materialCategoryNodeId(fragment.categoryId, category?.layer === 'TN' ? fragment.regionId : ''), children: [], packageId: item.id, package: item, fragmentId: fragment.id, categoryId: fragment.categoryId, regionId: fragment.regionId, control: { kind: 'package', id: item.id }, terms: [fragment.title, ...nameFields(fragment), ...nameFields(category)], contextTerms: materialRegionPath(library, fragment.regionId).flatMap(nameFields) });
      packageNodes.set(item.id, node);
      continue;
    }
    const group = controls.get(item.uiGroupId);
    let parentId = item.administrativeControlGroupIds?.length ? 'admin:' + item.administrativeControlGroupIds.at(-1) : item.legacyMaterialRegionId && nodes.has('material-region:' + item.legacyMaterialRegionId) ? 'material-region:' + item.legacyMaterialRegionId : 'layer:' + item.layer;
    if (!nodes.has(parentId)) parentId = 'layer:' + item.layer;
    if (group?.mode !== 'singleton') {
      const viewId = 'group:' + item.layer + ':' + parentId + ':' + item.uiGroupId;
      if (!nodes.has(viewId)) register({ id: viewId, name: data.placeMetadata?.groupNames?.[item.uiGroupId] || group?.label || item.parentGroup || item.uiGroupId, layer: item.layer, kind: 'group', type: '资料组', parentId, children: [], control: { kind: 'group', id: item.uiGroupId }, terms: [group?.label || item.parentGroup || item.uiGroupId, data.placeMetadata?.groupNames?.[item.uiGroupId]] });
      parentId = viewId;
    }
    const presentation = engine.getPlacePresentation(item);
    const place = places.get(item.placeId), canonical = canonicalPlaceContext(item.canonicalPlaceId || item.placeId, data);
    const node = register({ id: 'package:' + item.id, name: packageDisplayName(item, data), layer: item.layer, kind: 'package', type: (presentation.typeLabels || []).join('／') || (item.placeKind === 'station' ? '站点正文' : '正文'), parentId, children: [], packageId: item.id, package: item, control: { kind: 'package', id: item.id }, terms: [...nameFields(item), packageDisplayName(item, data), ...(item.fullTriggers || []), ...(item.aliasTriggers || []), ...nameFields(place), ...nameFields(canonical), ...(presentation.searchTerms || []), ...((data.placeNameAliases?.objects || {})[item.sourceObjectId] || [])], contextTerms: [...parentNames(place), ...parentNames(canonical)] });
    packageNodes.set(item.id, node);
  }
  for (const node of nodes.values()) {
    node.canOwnBody = Boolean(node.packageId);
    node.bodyControl = node.packageId ? { kind: 'package', id: node.packageId } : null;
    node.branchControl = node.control.kind !== 'package' ? node.control : null;
  }
  const path = id => { const result = []; let node = nodes.get(typeof id === 'string' ? id : id.id); while (node) { result.unshift(node); node = nodes.get(node.parentId); } return result; };
  // LJ-MATERIAL-SCOPE-20261103: place bodies retain lookup and control ancestry outside the term list.
  const termNodes = new Set();
  for (const node of nodes.values()) {
    if (['layer', 'material-region', 'material-category'].includes(node.kind) || (node.package && !isPlaceBodyPackage(node.package))) {
      for (const parent of path(node.id)) termNodes.add(parent.id);
    }
  }
  for (const node of nodes.values()) {
    if (node.parentId && termNodes.has(node.id)) nodes.get(node.parentId)?.children.push(node.id);
  }
  const documents = [...nodes.values()].filter(node => termNodes.has(node.id)).map(node => ({ node, own: prepareSearchFields([node.name, ...node.terms, node.type]),
    context: prepareSearchFields([...(node.contextTerms || []), ...path(node.id).slice(0, -1).flatMap(parent => [parent.name, ...parent.terms])]) }));
  let queryKey = '', result = [];
  return { roots, nodes, packageNodes, termNodes, path, search(query) {
    const key = normalizeSearchText(query);
    if (key !== queryKey) {
      const tokens = tokenizeSearchQuery(key);
      result = tokens.length ? documents.filter(row => matchesPreparedSearchFields(row.own, tokens, row.context)).map(row => row.node) : [];
      queryKey = key;
    }
    return result;
  } };
}

const controlFor = (node, scope) => scope === 'body' ? node.bodyControl || (node.packageId ? { kind: 'package', id: node.packageId } : null) : node.control;
const controlValue = (settings, control) => !control || (control.kind === 'layer' ? settings.layers : control.kind === 'package' ? settings.packages : settings.groups)[control.id] !== false;
export function applyMaterialSelection(settings, selectedNodes, enabled, scope = 'branch') {
  const next = copy(settings);
  for (const node of selectedNodes) {
    const control = controlFor(node, scope); if (!control) continue;
    const target = control.kind === 'layer' ? next.layers : control.kind === 'package' ? next.packages : next.groups;
    target[control.id] = Boolean(enabled);
  }
  return next;
}

// LJ-MATERIAL-WORKBENCH-01: bulk actions target the selected bodies.
export const materialBodySelection = nodes => nodes.filter(node => node.packageId);

export function materialState(node, settings, model, scope = 'branch') {
  const bodyOn = controlValue(settings, controlFor(node, 'body')), branchOn = controlValue(settings, node.branchControl || (node.control.kind !== 'package' ? node.control : null));
  const reasons = [];
  if (!settings.masterEnabled) reasons.push('自动扫描已关闭');
  if (settings.layers[node.layer] === false) reasons.push(layerNames[node.layer] + '全局取用已暂停');
  for (const part of model.path(node.id)) {
    const branch = part.branchControl || (part.control.kind !== 'package' ? part.control : null);
    if (part.kind === 'layer' && !model.termNodes.has(node.id)) continue;
    if (branch && !controlValue(settings, branch)) reasons.push(part.name + '分支已暂停');
  }
  if ((scope === 'body' || node.kind === 'package') && node.packageId && !bodyOn) reasons.push(node.name + '本级正文已关闭');
  if (isPlaceBodyPackage(node.package) && settings.namedPlaceBodiesEnabled === false) reasons.push('具名地点正文已暂停');
  if (node.package) {
    for (const id of node.package.controlGroupIds || []) {
      if (settings.groups[id] !== false || model.path(node.id).some(part => part.control.id === id)) continue;
      reasons.push('共享对象开关已暂停');
    }
  }
  return { own: scope === 'body' || node.kind === 'package' ? bodyOn : branchOn, bodyOn, branchOn, effective: reasons.length === 0, reasons: [...new Set(reasons)] };
}

export function materialPage(rows, offset = 0, pageSize = 24) {
  const size = Math.min(48, Math.max(1, pageSize));
  const start = Math.min(Math.max(0, offset), Math.max(0, Math.floor((rows.length - 1) / size) * size));
  return { rows: rows.slice(start, start + size), offset: start, total: rows.length, hasPrevious: start > 0, hasNext: start + size < rows.length, pageSize: size };
}

export function mountMaterials(ui) {
  const desktop = ui.layout === 'desktop';
  const doc = document, select = id => doc.getElementById(id);
  const esc = ui.esc || (value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]));
  const list = select(desktop ? 'pkg10List' : 'packageList');
  if (!list) return { render() {}, locate() {} };
  const root = list.closest(desktop ? '#ljPackagesPage' : '[data-page-root]') || list.parentElement.parentElement;
  const placeReturn = doc.createElement('div'); placeReturn.className = 'lj-place-material-return'; placeReturn.hidden = true;
  placeReturn.innerHTML = '<button type="button" data-material-action="return-place">← 返回地点编辑</button><span>词条正文单独保存；地点草稿已保留。</span>';
  const roots = select(desktop ? 'pkg10Roots' : 'packageRoots');
  const crumbs = select(desktop ? 'pkg10Crumbs' : 'packageCrumbs');
  const currentSwitch = select(desktop ? 'pkg10CurrentSwitch' : 'packageCurrentSwitch');
  const effective = select(desktop ? 'pkg10Effective' : 'packageEffective');
  const sibling = select(desktop ? 'pkg10SiblingSelect' : 'packageSibling');
  const back = select(desktop ? 'pkg10Back' : 'packageBack');
  const modified = select(desktop ? 'pkg10ModifiedOnly' : 'packageModifiedOnly');
  crumbs.hidden = true; crumbs.innerHTML = '';
  if (!desktop) {
    const previousRow = back.closest('.rowline'), navigation = sibling.closest('.rowline');
    if (navigation && previousRow !== navigation) { navigation.prepend(back); previousRow?.remove(); navigation.classList.add('lj-material-navigation'); }
  }
  const state = ui.state.materials ||= { currentId: 'layer:TN', query: '', offset: 0, multi: false, selected: [], modified: false, drill: false, source: null, searchBase: null, highlighted: null };
  let model, modelData, busy = false, composing = false, paintTimer = null;
  function cancelPendingPaint() { clearTimeout(paintTimer); paintTimer = null; }
  window.addEventListener('pagehide', cancelPendingPaint, { once: true });
  const pageSize = desktop ? 48 : 24;
  if (!select('ljMaterialsStyle')) { const style = doc.createElement('link'); style.id = 'ljMaterialsStyle'; style.rel = 'stylesheet'; style.href = new URL('./materials.css', import.meta.url).href; doc.head.append(style); }
  const searchBar = doc.createElement('div'); searchBar.className = desktop ? 'pkg10-searchfield lj-material-search' : 'mv-search lj-material-search';
  searchBar.innerHTML = '<span aria-hidden="true">⌕</span><input type="search" aria-label="搜索资料名称、别名或类型" placeholder="搜索名称、别名、类型"><button type="button" data-material-action="clear" aria-label="退出资料搜索">×</button>';
  const head = desktop ? root.querySelector('.loc10-pagehead') : roots;
  if (desktop) head?.insertBefore(searchBar, head.lastElementChild);
  else {
    // LJ-MATERIAL-SEARCHROW-20261102: move the original filter beside search without replacing its state or events.
    const searchRow = doc.createElement('div'); searchRow.className = 'lj-material-searchrow';
    searchRow.append(searchBar);
    const filter = modified?.closest('label'); if (filter) searchRow.append(filter);
    head?.after(searchRow);
  }
  const input = searchBar.querySelector('input'); input.value = state.query;
  const toolbar = doc.createElement('div'); toolbar.className = 'lj-selectbar lj-material-tools';
  list.before(toolbar);
  const footer = doc.createElement('div'); footer.className = 'lj-selectbar lj-material-pages'; list.after(footer);
  if (desktop) {
    const workspace = doc.createElement('div'); workspace.className = 'pkg10-workspace lj-live-materials';
    const manager = doc.createElement('section'); manager.className = 'pkg10-manager';
    const context = root.querySelector('.pkg10-context'); context.classList.add('lj-material-identity');
    const dock = doc.createElement('section'); dock.id = 'ljPackageTextDock'; dock.className = 'pkg10-textdock';
    dock.setAttribute('aria-label', '资料正文读写');
    dock.innerHTML = '<div class="pkg10-reader-empty"><strong>选择资料阅读正文</strong><p>左侧清单保持当前位置，正文与修改稿在这里切换。</p></div>';
    const table = list.closest('.pkg10-table');
    context.before(workspace); manager.append(context, toolbar, list, footer); workspace.append(manager, dock); table?.remove();
  }
  if (modified) modified.checked = state.modified;
  function getModel() { if (modelData !== ui.engine.data) { modelData = ui.engine.data; model = buildMaterialsModel(ui.engine); } if (!model.termNodes.has(state.currentId)) state.currentId = model.roots[0].id; return model; }
  function mode() { return state.drill ? 'normal' : state.query ? 'search' : state.modified ? 'modified' : 'normal'; }
  function snapshot() { return { currentId: state.currentId, offset: state.offset, modified: state.modified, highlighted: state.highlighted, drill: state.drill, source: state.source, scrollTop: list.scrollTop }; }
  function savedPackages() { return new Set(Object.values(ui.engine.normalizeTextOverrides(ui.bridge.store.read().livingJapanTextOverrides).records).map(record => record.packageId)); }
  function rows() { const currentMode = mode(); if (currentMode === 'search') return model.search(state.query); if (currentMode === 'modified') { const saved = savedPackages(); return [...model.packageNodes.values()].filter(node => model.termNodes.has(node.id) && saved.has(node.packageId)); } return model.nodes.get(state.currentId).children.map(id => model.nodes.get(id)); }
  const button = (text, action, attributes = '') => `<button type="button" class="lj-button" data-material-action="${action}" ${attributes}>${text}</button>`;
  const switchHTML = (node, on, scope) => `<button type="button" class="${desktop ? 'pkg10-switch' : 'switch'} ${on ? 'on' : ''}" data-material-toggle="${esc(node.id)}" data-material-scope="${scope}" aria-pressed="${on}" aria-label="${esc(node.name)}${scope === 'body' ? '本级正文' : '整支'}开关"></button>`;
  const showBranch = (node, settings) => node.branchControl && (node.children.length || !node.canOwnBody || !controlValue(settings, node.branchControl));
  const textState = (node, settings) => materialState(node, settings, model, node.canOwnBody ? 'body' : 'branch');
  function statusHTML(node, settings) { const status = textState(node, settings); return status.effective ? '' : `<button type="button" class="lj-material-paused" data-material-reason="${esc(node.id)}" title="${esc(status.reasons.join('；'))}">${node.canOwnBody && !status.bodyOn ? '正文关闭' : '暂停'}</button>`; }
  function rowHTML(node, settings, saved) {
    const control = textState(node, settings), multi = state.multi && mode() === 'search', pick = multi && node.canOwnBody, selected = state.selected.includes(node.id);
    const path = mode() === 'normal' ? '' : model.path(node.id).slice(0, -1).map(part => part.name).join(' › ');
    const source = node.canOwnBody ? saved.has(node.packageId) ? '修改稿' : (node.package.hasBody || node.package.body) ? '内置' : '空白' : '';
    const details = [node.children.length ? node.children.length + ' 个直接内容' : source ? source + '正文' : '暂无下级', node.fragmentId ? materialRegionPath(ui.engine.data.materialLibrary, node.bodyRegionId || node.regionId).at(-1)?.name : '', path].filter(Boolean).join(' · ');
    const action = pick ? 'data-material-pick' : node.canOwnBody && !node.children.length ? 'data-material-read' : 'data-material-enter';
    const pickHTML = pick ? `<input class="lj-material-pick" type="checkbox" data-material-pick="${esc(node.id)}" ${selected ? 'checked' : ''} aria-label="选择${esc(node.name)}本级正文">` : '';
    const branch = showBranch(node, settings) ? `<div class="lj-material-controlzone"><span class="lj-material-controlmain"><span>整支</span>${multi ? `<small>${control.branchOn ? '开启' : '暂停'}</small>` : switchHTML(node, control.branchOn, 'branch')}</span>${node.children.length ? `<button type="button" class="lj-enter" data-material-enter="${esc(node.id)}" aria-label="进入${esc(node.name)}下级">下级 ›</button>` : ''}</div>` : '';
    const body = node.canOwnBody ? `<div class="lj-material-controlzone"><span class="lj-material-controlmain"><span>正文</span>${multi ? '' : switchHTML(node, control.bodyOn, 'body')}</span><button type="button" class="lj-button lj-material-read" data-material-read="${esc(node.id)}" aria-label="查看${esc(node.name)}正文"><small>${source}</small><span>正文</span></button></div>` : '';
    if (desktop) return `<article class="pkg10-row lj-material-row ${control.effective ? '' : 'inherited'} ${selected || state.highlighted === node.id ? 'selected' : ''}"><div class="pkg10-namecell">${pickHTML}<button type="button" class="pkg10-open" ${action}="${esc(node.id)}"><span class="pkg10-name">${esc(node.name)}</span><span class="lj-meta">${esc(node.type + ' · ' + details)}</span></button>${statusHTML(node, settings)}</div><div class="lj-material-actions">${branch}${body}</div></article>`;
    return `<article class="lj-row lj-material-row ${selected || state.highlighted === node.id ? 'selected' : ''}">${pickHTML}<div class="lj-material-name"><button type="button" class="lj-namebutton" ${action}="${esc(node.id)}"><span class="lj-name">${esc(node.name)}</span><span class="lj-meta">${esc(node.type + ' · ' + details)}</span></button>${statusHTML(node, settings)}</div><div class="lj-material-actions">${branch}${body}</div></article>`;
  }
  function render() {
    cancelPendingPaint();
    placeReturn.hidden = !ui.canReturnToPlace?.();
    const previousScroll = list.scrollTop;
    getModel();
    const settings = ui.engine.normalizeSettings(ui.bridge.store.read().livingJapanSettings), current = model.nodes.get(state.currentId), path = model.path(current.id), currentMode = mode();
    const allRows = rows(), page = materialPage(allRows, state.offset, pageSize), saved = savedPackages(); state.offset = page.offset;
    roots.innerHTML = model.roots.map(node => `<button type="button" class="${desktop ? 'pkg10-root ' : ''}${node.id === path[0].id ? 'on ' : ''}${materialState(node, settings, model).branchOn ? 'enabled' : ''}" data-material-enter="${esc(node.id)}"><span><i></i>${esc(node.name)}</span></button>`).join('');
    const siblings = current.parentId ? model.nodes.get(current.parentId).children.map(id => model.nodes.get(id)) : model.roots;
    sibling.innerHTML = siblings.map(node => `<option value="${esc(node.id)}" ${node.id === current.id ? 'selected' : ''}>${esc(node.name)}</option>`).join('');
    sibling.title = current.name;
    back.disabled = !current.parentId && !state.source; back.textContent = state.source ? '← 返回' + (state.source.mode === 'search' ? '搜索' : '修改稿') : '← 上一级';
    const status = textState(current, settings); currentSwitch.classList.toggle('on', status.branchOn); currentSwitch.setAttribute('aria-pressed', String(status.branchOn)); currentSwitch.setAttribute('aria-label', current.name + '整支开关'); currentSwitch.disabled = busy;
    effective.textContent = !status.branchOn ? '本分支暂停' : status.effective ? '开关允许取用' : current.canOwnBody && !status.bodyOn ? '本级正文关闭' : '取用已暂停'; effective.title = status.reasons.join('；');
    currentSwitch.hidden = !showBranch(current, settings) || currentMode === 'search' && state.multi;
    const currentGroup = currentSwitch.closest('.pkg10-current'); if (currentGroup) { currentGroup.hidden = currentSwitch.hidden; const label = currentGroup.querySelector('b'); if (label) label.textContent = '整支'; }
    const selected = state.selected.filter(id => materialBodySelection(allRows).some(node => node.id === id));
    const canAdd = ui.engine.data.materialLibrary && ['layer', 'material-region', 'material-category'].includes(current.kind);
    toolbar.innerHTML = currentMode === 'search' ? `<span>全资料 · ${allRows.length} 项匹配</span>${button(state.multi ? '完成多选' : '多选', 'multi')}${state.multi ? `<span>已选 ${selected.length} 项</span>${button('全选匹配', 'all')}${button('取消勾选', 'none')}${button('开启所选', 'bulk-on', selected.length && !busy ? '' : 'disabled')}${button('关闭所选', 'bulk-off', selected.length && !busy ? '' : 'disabled')}` : ''}` : `<span>${currentMode === 'modified' ? '全部修改稿' : esc(current.name)} · ${allRows.length} 项</span>${current.canOwnBody && currentMode === 'normal' ? `<span class="lj-material-currentbody"><span>本级正文</span>${switchHTML(current, status.bodyOn, 'body')}${button('正文', 'read', `data-material-id="${esc(current.id)}"`)}</span>` : ''}${statusHTML(current, settings)}${current.categoryId && currentMode === 'normal' ? button('独立有效词', 'keywords') : ''}${canAdd && currentMode === 'normal' ? `<button type="button" class="lj-button lj-material-add" data-material-action="add">＋新增</button>` : ''}`;
    toolbar.prepend(placeReturn);
    list.innerHTML = page.rows.map(node => rowHTML(node, settings, saved)).join('') || '<div class="lj-empty">' + (currentMode === 'search' ? '没有匹配的名称、别名或类型。' : currentMode === 'modified' ? '尚未保存修改稿。' : '当前层暂无直接内容。') + '</div>';
    footer.innerHTML = `<span>${page.total ? page.offset + 1 : 0}–${Math.min(page.offset + pageSize, page.total)} / ${page.total}</span>${button('上一页', 'prev', page.hasPrevious ? '' : 'disabled')}${button('下一页', 'next', page.hasNext ? '' : 'disabled')}`;
    const count = select(desktop ? 'pkg10ListCount' : 'packageOffCount'); if (count) count.textContent = materialBodySelection(allRows).filter(node => !materialState(node, settings, model, 'body').own).length + ' 项本级关闭';
    searchBar.querySelector('button').hidden = !state.query;
    if (modified) { modified.checked = state.modified; modified.closest('label').hidden = Boolean(state.query); }
    root.querySelectorAll('[data-material-toggle]').forEach(node => { node.disabled = busy; });
    list.scrollTop = previousScroll;
  }
  async function enter(id) {
    if (!model.termNodes.has(id) || (ui.reader && !(await ui.reader.close()))) return;
    const currentMode = mode(); if (currentMode !== 'normal') state.source = { ...snapshot(), mode: currentMode };
    state.currentId = id; state.offset = 0; state.drill = Boolean(state.query || state.modified); state.highlighted = null; render(); list.scrollTop = 0;
  }
  function returnSource() { if (!state.source) return; const original = state.source; Object.assign(state, original); state.source = null; state.drill = false; render(); list.scrollTop = original.scrollTop || 0; }
  function queryChanged() {
    const value = input.value.trim();
    if (value === state.query) return;
    cancelPendingPaint();
    if (!value) { const original = state.searchBase; if (original) Object.assign(state, original); else { state.source = null; state.drill = false; } state.query = ''; state.searchBase = null; state.multi = false; state.selected = []; render(); list.scrollTop = original?.scrollTop || 0; return; }
    if (!state.query) state.searchBase = snapshot();
    if (value !== state.query) state.selected = [];
    state.query = value; state.offset = 0; state.source = null; state.drill = false;
    paintTimer = setTimeout(() => { render(); list.scrollTop = 0; }, 120);
  }
  async function save(nodes, value, scope = 'branch') {
    if (busy || !nodes.length) return; busy = true; render();
    const prior = ui.engine.normalizeSettings(ui.bridge.store.read().livingJapanSettings);
    const changed = nodes.filter(node => materialState(node, prior, model, scope).own !== value).length;
    try {
      await ui.bridge.session.runtime.saveSettings(applyMaterialSelection(ui.engine.normalizeSettings(ui.bridge.store.read().livingJapanSettings), nodes, value, scope));
      await ui.bridge.session.refresh();
      ui.notify(nodes.length === 1 ? scope === 'body' || nodes[0].kind === 'package' ? '已' + (value ? '开启' : '关闭') + '本级正文' : '已' + (value ? '开放' : '暂停') + '当前分支，下级选择保留' : `所选 ${nodes.length} 项正文，实际改动 ${changed} 项；未改分支开关`);
    } catch (error) { ui.notify(error.message, 'error'); }
    finally { busy = false; render(); ui.reader?.render?.(); }
  }
  async function read(id) { const node = model.nodes.get(id); if (!node?.packageId) return; const entity = await ui.getEntityForPackage(node.packageId); if (await ui.openReader(entity || { id: node.package.placeId || node.packageId, name: node.name, packageIds: [node.packageId] }, node.packageId) !== false) { state.highlighted = id; render(); } }
  root.addEventListener('click', async event => {
    const target = event.target.closest('button,input[data-material-pick]'); if (!target || target.disabled) return;
    try {
      if (target.dataset.materialPick) { const id = target.dataset.materialPick; state.selected = state.selected.includes(id) ? state.selected.filter(value => value !== id) : [...state.selected, id]; render(); }
      else if (target.dataset.materialToggle) { const node = model.nodes.get(target.dataset.materialToggle), settings = ui.engine.normalizeSettings(ui.bridge.store.read().livingJapanSettings), scope = target.dataset.materialScope || 'branch'; await save([node], !materialState(node, settings, model, scope).own, scope); }
      else if (target.dataset.materialRead) await read(target.dataset.materialRead);
      else if (target.dataset.materialEnter) await enter(target.dataset.materialEnter);
      else if (target.dataset.materialReason) { const node = model.nodes.get(target.dataset.materialReason), status = textState(node, ui.engine.normalizeSettings(ui.bridge.store.read().livingJapanSettings)); await ui.ask({ title: node.name, message: status.reasons.join('；'), choices: [{ id: 'ok', label: '知道了' }] }); }
      else if (target.dataset.materialAction) {
        const action = target.dataset.materialAction;
        if (action === 'return-place') await ui.returnToPlace();
        if (action === 'add') await ui.materialEditor.add(model.nodes.get(state.currentId));
        if (action === 'keywords') await ui.materialEditor.editKeywords(model.nodes.get(state.currentId)?.categoryId);
        if (action === 'read') await read(target.dataset.materialId);
        if (action === 'clear') { input.value = ''; queryChanged(); }
        if (action === 'multi') { state.multi = !state.multi; render(); }
        if (action === 'all') { state.selected = materialBodySelection(rows()).map(node => node.id); render(); }
        if (action === 'none') { state.selected = []; render(); }
        if (action === 'source') returnSource();
        if (action === 'prev' || action === 'next') { state.offset += action === 'next' ? pageSize : -pageSize; render(); list.scrollTop = 0; }
        if (action === 'bulk-on' || action === 'bulk-off') await save(materialBodySelection(rows()).filter(node => state.selected.includes(node.id)), action === 'bulk-on', 'body');
      }
    } catch (error) { ui.notify(error.message, 'error'); }
  });
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; queryChanged(); });
  input.addEventListener('input', event => { if (!composing && !event.isComposing) queryChanged(); });
  modified?.addEventListener('change', () => { state.modified = modified.checked; state.offset = 0; state.drill = false; state.source = null; render(); });
  sibling.onchange = () => enter(sibling.value);
  back.onclick = () => state.source ? returnSource() : enter(model.nodes.get(state.currentId).parentId);
  currentSwitch.onclick = () => { const node = model.nodes.get(state.currentId); save([node], !materialState(node, ui.engine.normalizeSettings(ui.bridge.store.read().livingJapanSettings), model).own); };
  return { render, async locate(id) {
    getModel(); const fromBody = model.packageNodes.has(id), node = model.packageNodes.get(id) || model.nodes.get(id);
    if (!node || !model.termNodes.has(node.id) || !(await ui.showPage('packages'))) return false;
    if (mode() !== 'normal') state.source = { ...snapshot(), mode: mode() };
    state.currentId = fromBody ? node.parentId : node.id; state.drill = Boolean(state.query || state.modified); state.highlighted = node.id;
    state.offset = fromBody ? Math.max(0, Math.floor(model.nodes.get(node.parentId).children.indexOf(node.id) / pageSize)) * pageSize : 0;
    render(); list.querySelector(`[data-material-read="${CSS.escape(node.id)}"]`)?.scrollIntoView({ block: 'nearest' }); return true;
  } };
}
