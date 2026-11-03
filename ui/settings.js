import { MAP_POINT_CATEGORIES, MAP_POINT_GROUPS, normalizeMapPointVisibility } from '../src/map-point-categories.js';
import { METRO_POINT_CATEGORIES, METRO_POINT_GROUPS, normalizeMetroPointVisibility } from '../src/metro-point-categories.js';
import { MATERIAL_LAYER_LABELS } from '../src/material-catalog.js';
import { DEFAULT_PEER_PLACE_QUOTA, normalizePeerPlaceQuotas, PEER_PLACE_CATEGORIES, PEER_PLACE_GROUPS } from '../src/peer-place-selection.js';
import { GUIDE_CHAPTERS } from './guide.js';
import { WORKFLOW_CHAPTERS } from './workflow-chapters.js';

const clone = value => JSON.parse(JSON.stringify(value));
const CHANNELS = Object.entries(MATERIAL_LAYER_LABELS);
const TABS = [['common', '常用设置'], ['reading', '读取设置'], ['favorites', '地点设置'], ['backup', '备份与说明']];
const TAB_NOTES = { common: '常用设置即时保存', reading: '读取设置由本组统一保存', favorites: '分类即时保存；四个常用地点独立保存', backup: '个人备份与扩展更新分开' };
const READING_KEYS = ['textScript', 'wrapperMode', 'historyDepth', 'currentUserBoundary', 'channelTags'];
const splitTags = value => [...new Set(String(value).split(/[，,、;；\n]+/).map(item => item.trim()).filter(Boolean))];
const updateBytes = value => Number.isFinite(value) ? value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)} MB` : value >= 1_000 ? `${(value / 1_000).toFixed(1)} kB` : `${value} B` : '待检查';
const updateVersion = value => value && !/[a-f0-9]{12,}/i.test(String(value)) ? String(value) : '';
const updateText = value => String(value || '').replace(/(?:overture-test-)?[a-f0-9]{12,}/gi, '（内部标识已省略）');
// LJ-MAP-POINT-SETTINGS-20261102: nationwide controls, compact category browser; see the independent implementation notebook.
const metroSwitchCategories = METRO_POINT_CATEGORIES.filter(row => !['in.transport.station', 'in.transport.bus'].includes(row.id));
const metroSwitchIds = new Set(metroSwitchCategories.map(row => row.id));
const MAP_POINT_SCOPES = [
  ...[['IN', '场馆与店铺'], ['EX', '街区与户外']].map(([id, label]) => ({ id, label,
    categories: metroSwitchCategories.filter(row => row.layer === id), groups: METRO_POINT_GROUPS.filter(row => row.layer === id)
      .map(row => ({ ...row, categoryIds: row.categoryIds.filter(categoryId => metroSwitchIds.has(categoryId)) })) })),
  { id: 'legacy', label: '通用分类', categories: MAP_POINT_CATEGORIES, groups: MAP_POINT_GROUPS },
];
const metroParentIds = new Set(METRO_POINT_CATEGORIES.map(row => row.parentId).filter(Boolean));
const mapPointCategories = MAP_POINT_SCOPES.flatMap(scope => scope.categories);
const mapPointLabels = new Map(mapPointCategories.map(item => [item.id, item.label + (metroParentIds.has(item.id) ? '（未细分）' : '')]));
const PEER_PLACE_SCOPES = [['IN', '场馆与店铺'], ['EX', '街区与户外'], ['legacy', '通用分类']].map(([id, label]) => ({ id, label,
  categories: PEER_PLACE_CATEGORIES.filter(row => row.layer === id), groups: PEER_PLACE_GROUPS.filter(row => row.layer === id) }));
const peerPlaceLabels = new Map(PEER_PLACE_CATEGORIES.map(item => [item.id, item.label + (metroParentIds.has(item.id) ? '（未细分）' : '')]));

// LJ-SETTINGS-LIVE: approved layout-specific groups and controls share the real independent save scopes.
export function mountSettings(ui) {
  const { store, session, catalog, updates } = ui.bridge;
  const esc = ui.esc;
  const desktop = ui.layout === 'desktop';
  const mobile = ui.layout === 'mobile';
  const content = document.getElementById(desktop ? 'set12Content' : 'settingsScroll');
  const tabs = document.getElementById(desktop ? 'set12Tabs' : 'settingsTabs');
  if (!content || !tabs) return { render() {} };
  content.classList.add('lj-settings-live');
  if (mobile) content.closest('[data-page-root="settings"]').classList.add('mobile-settings');
  let tab = 'common', reading = null, favorites = null, readingDirty = false, favoritesDirty = false, busy = false;
  let status = '', tone = '', updateResult = updates?.getState?.() || null;
  let backupDownload = null;
  const packManager = ui.bridge.packages?.manager;
  let packUpdates = packManager?.getUpdateSummary?.() || { available: false, items: [] }, updateLog = null, logFocus = null;
  const favoriteMatches = new Map();
  const favoriteQueries = new Map();
  const quotaDrafts = new Map(), quotaErrors = new Set();
  let quotaSaveQueue = Promise.resolve();
  const scrolls = {};
  // LJ-PLACE-SETTINGS-20261102: shared category browser, independent quota drafts and real tabs in all layouts.
  const savedCategoryView = store.read().extensionUi?.placeCategoryView || {};
  const mapPointView = { mode: savedCategoryView.mode === 'introductions' ? 'introductions' : 'map',
    scope: MAP_POINT_SCOPES.some(scope => scope.id === savedCategoryView.scope) ? savedCategoryView.scope : 'IN',
    groups: Object.fromEntries(MAP_POINT_SCOPES.map(scope => [scope.id, scope.groups.some(group => group.id === savedCategoryView.groups?.[scope.id]) ? savedCategoryView.groups[scope.id] : scope.groups[0].id])), query: '', scrolls: {} };
  const settings = () => ui.engine.normalizeSettings(store.read().livingJapanSettings);
  const scroller = () => desktop ? content.querySelector('.set12-scroll') || content : content;
  const rememberScroll = () => { scrolls[tab] = scroller().scrollTop || 0; };
  content.addEventListener('scroll', rememberScroll, { capture: true, passive: true });
  const group = (title, note, body, id = '') => desktop
    ? `<section class="set12-group"${id ? ` id="${id}"` : ''}><div class="set12-grouphead"><h3>${esc(title)}</h3><span class="set12-savekind">${esc(note || '')}</span></div>${body}</section>`
    : `<section class="set-group"${id ? ` id="${id}"` : ''}><h3>${esc(title)}<span class="save-note">${esc(note || '')}</span></h3>${body}</section>`;
  const button = (action, text, primary = false, extra = '', classes = '') => `<button type="button" class="${desktop ? 'set12-button' : 'btn'}${primary ? ' primary' : ''}${classes ? ` ${classes}` : ''}" data-settings-action="${action}" ${extra}>${esc(text)}</button>`;
  const row = (label, control, note = '', inline = false) => desktop
    ? `<div class="set12-row"><div class="set12-copy"><strong>${esc(label)}</strong>${note ? `<p>${esc(note)}</p>` : ''}</div><div class="set12-control">${control}</div></div>`
    : `<div class="set-row"><div class="set-label"><b>${esc(label)}</b>${inline ? control : ''}</div>${note ? `<p>${esc(note)}</p>` : ''}${inline ? '' : `<div class="set-control">${control}</div>`}</div>`;
  const select = (key, value, choices, scope = 'common') => `<select${desktop ? '' : ' class="input grow"'} data-settings-${scope}="${key}" aria-label="${esc(key)}">${choices.map(([id, label]) => `<option value="${esc(id)}"${id === value ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
  const switchClass = on => `${desktop ? 'pkg10-switch' : 'switch'}${on ? ' on' : ''}`;
  const toggle = (key, on, label) => `<button type="button" class="${switchClass(on)}" data-settings-common="${key}" aria-label="${esc(label)}" aria-pressed="${Boolean(on)}"></button>`;
  const controlButtons = choices => `${desktop ? '<div class="set12-segment">' : ''}${choices.map(([id, label]) => `<button type="button" class="${desktop ? (ui.layout === id ? 'on' : '') : `btn${ui.layout === id ? ' soft' : ''}`}" data-settings-common="layout" data-settings-value="${id}" aria-pressed="${ui.layout === id}">${esc(label)}</button>`).join('')}${desktop ? '</div>' : ''}`;
  const saveBar = kind => {
    const dirty = kind === 'reading' ? readingDirty : favoritesDirty;
    const label = kind === 'reading' ? '保存读取设置' : '保存常用地点';
    const text = dirty ? '有尚未保存的修改' : '当前没有待保存修改';
    if (desktop) return `<div class="set12-savebar"><p${dirty ? ' class="dirty"' : ''} data-settings-dirty="${kind}">${text}</p>${button(`save-${kind}`, label, true)}</div>`;
    if (mobile && kind === 'reading') return `<div class="mobile-reading-save"><p data-settings-dirty="${kind}" role="status">${text}</p>${button(`save-${kind}`, label, true)}</div>`;
    return `<p class="lj-settings-group-status" data-settings-dirty="${kind}" role="status">${text}</p>${button(`save-${kind}`, label, kind === 'reading', '', 'group-save')}`;
  };
  function initDrafts() {
    if (!reading || !readingDirty) {
      const saved = settings();
      reading = Object.fromEntries(READING_KEYS.map(key => [key, clone(saved[key])]));
    }
    if (!favorites || !favoritesDirty) {
      const saved = store.read();
      const existing = saved.extensionUi?.favorites || saved.livingJapanUIPreferences?.transitFavoritePlaces?.slots || [];
      favorites = Array.from({ length: 4 }, (_, index) => {
        const item = existing[index] || {};
        let entity = item.entityId ? catalog.get(item.entityId) : null;
        if (!entity && item.endpoint?.id) entity = catalog.get(item.endpoint.id) || catalog.get(`place:station:${item.endpoint.id}`) || catalog.get(`place:content_object:${item.endpoint.id}`);
        return { slotId: item.slotId || `favorite_${index + 1}`, displayName: item.displayName || '', entityId: item.entityId || entity?.id || '', regionCode: item.regionCode || entity?.regionCode || '', name: item.name || entity?.name || item.endpoint?.name || item.endpoint?.displayName || '' };
      });
    }
  }
  function commonHtml() {
    const saved = store.read(), value = settings();
    const interfaceRows = row('横版／竖版／手机版', controlButtons([['desktop', '横版'], ['portrait', '竖版'], ['mobile', '手机版']])) +
      row('界面主题', select('theme', saved.extensionUi?.theme || 'auto', [['auto', '跟随系统'], ['day', '日间'], ['night', '夜间']])) +
      row('锁定界面', toggle('pinned', saved.extensionUi?.pinned ?? saved.livingJapanUIPreferences?.panelPinned, '锁定界面'), '锁定后点击面板外部不关闭，位置仍可调整。', true) +
      row('提示注入', toggle('masterEnabled', value.masterEnabled, '提示注入'), '控制自动读取；手动追加地点名称与路线独立。', true) +
      row('跳过用户地点输入', toggle('skipUserLocationInput', value.skipUserLocationInput === true, '跳过用户地点输入'), '地点改读最近 AI 回复；时间天气照常', true) +
      row('具名地点正文', toggle('namedPlaceBodiesEnabled', value.namedPlaceBodiesEnabled, '具名地点正文'), '', true) +
      row('同级其他大生活带介绍', toggle('expandPeerLivingAreas', value.expandPeerLivingAreas, '展开同级其他大生活带介绍'), '开启后附带其他同级大片区的一句话介绍；没有介绍时显示名称。', true) +
      row('详细诊断', toggle('diagnostics', value.diagnostics, '详细诊断'), '', true);
    const channelRows = CHANNELS.map(([key, name]) => row(desktop ? name : `资料通道 · ${name}`, toggle(`layer:${key}`, value.layers[key], name), '', true)).join('');
    if (desktop) return group('界面与布局', '修改后即时保存', interfaceRows) + group('资料通道', '暂停通道保留各项选择', channelRows);
    return group('常用设置', '即时保存', interfaceRows + channelRows, 'settings-common');
  }
  const mapPointVisibility = value => ({ ...normalizeMapPointVisibility(value), ...normalizeMetroPointVisibility(value) });
  const categoryScopes = () => mapPointView.mode === 'introductions' ? PEER_PLACE_SCOPES : MAP_POINT_SCOPES;
  const activeMapScope = () => categoryScopes().find(scope => scope.id === mapPointView.scope);
  const activeMapGroup = () => activeMapScope().groups.find(item => item.id === mapPointView.groups[mapPointView.scope]) || activeMapScope().groups[0];
  const peerQuotas = () => normalizePeerPlaceQuotas(settings().peerPlaceQuotas);
  const persistCategoryView = () => store.update(draft => {
    draft.extensionUi ||= {};
    draft.extensionUi.placeCategoryView = { mode: mapPointView.mode, scope: mapPointView.scope, groups: { ...mapPointView.groups } };
  });
  const mapPointButton = (text, attrs) => `<button type="button" class="${desktop ? 'set12-button' : 'btn'}" ${attrs}>${text}</button>`;
  const mapPointCount = visibility => {
    const shown = mapPointCategories.filter(item => visibility[item.id]).length;
    return shown === mapPointCategories.length ? '全部类别已显示' : `已显示 ${shown} / ${mapPointCategories.length} 类`;
  };
  function mapPointsHtml(value) {
    const visibility = mapPointVisibility(value), introductions = mapPointView.mode === 'introductions';
    return `<div class="lj-map-point-settings${introductions ? ' lj-peer-quota-mode' : ''}" data-map-point-settings><div class="lj-place-category-modes" aria-label="地点分类用途">${[['map', '地图显示'], ['introductions', '同级介绍']].map(([id, label]) => `<button type="button" data-place-category-mode="${id}" aria-pressed="${mapPointView.mode === id}">${label}</button>`).join('')}</div>` +
      (introductions ? '' : `<div class="lj-map-point-global"><span>适用于全部地区</span><div class="lj-map-point-actions">${mapPointButton('全部显示', 'data-map-point-all="show"')}${mapPointButton('全部隐藏', 'data-map-point-all="hide"')}</div></div>`) +
      `<div class="lj-map-point-search"><label for="lj-map-point-search">查找分类</label><input id="lj-map-point-search" type="search" data-map-point-search value="${esc(mapPointView.query)}" placeholder="输入名称，查找所有分类" autocomplete="off">${mapPointButton('清空', `data-map-point-clear-search${mapPointView.query ? '' : ' hidden'}`)}${introductions ? '' : `<span data-map-point-count>${mapPointCount(visibility)}</span>`}</div>` +
      `<div data-map-point-browser>${mapPointBrowserHtml(visibility)}</div><p class="lj-map-point-note">${introductions ? '只限制同级地点的附带介绍。收藏优先取用，普通地点随机补足。' : '只控制地图上的点和名称；目录、正文及已选地点保留。电车站、地形和生活片区沿用现有显示规则。'}</p></div>`;
  }
  function mapPointBrowserHtml(visibility) {
    const scope = activeMapScope(), current = activeMapGroup(), query = mapPointView.query.trim().toLowerCase(), introductions = mapPointView.mode === 'introductions';
    const quotas = peerQuotas(), labels = introductions ? peerPlaceLabels : mapPointLabels;
    const count = item => item.categoryIds.filter(id => visibility[id]).length;
    const groupCount = item => introductions ? `${item.categoryIds.length} 类` : `${count(item)} / ${item.categoryIds.length}`;
    const rows = (owner, item) => [...item.categoryIds].sort((a, b) => Number(metroParentIds.has(a)) - Number(metroParentIds.has(b)))
      .map(id => ({ id, label: labels.get(id), path: `${owner.label} · ${item.label}` }));
    const items = query ? categoryScopes().flatMap(owner => owner.groups.flatMap(item => rows(owner, item)))
      .filter(item => `${item.label} ${item.path}`.toLowerCase().includes(query)) : rows(scope, current);
    // LJ-PEER-QUOTA-HINTS-20261103: explain group, row limit and unspecialized entries beside their controls.
    const quotaControl = item => `<div class="lj-peer-quota-control"><label><input type="number" min="0" step="1" inputmode="numeric" data-peer-place-quota="${esc(item.id)}" value="${esc(quotaDrafts.has(item.id) ? quotaDrafts.get(item.id) : quotas[item.id] ?? DEFAULT_PEER_PLACE_QUOTA)}" aria-label="${esc(item.label)}同级介绍数量" aria-describedby="lj-peer-quota-limit-hint"${quotaErrors.has(item.id) ? ' aria-invalid="true"' : ''}><span>个</span></label>${quotaErrors.has(item.id) ? '<small role="alert">请输入 0 或正整数</small>' : ''}</div>`;
    return `<div class="lj-map-point-tabs" aria-label="地点类型">${categoryScopes().map(item => `<button type="button" data-map-point-select-scope="${item.id}" aria-pressed="${item.id === scope.id}">${esc(item.label)}</button>`).join('')}</div>` +
      `<div class="lj-map-point-browser${query ? ' searching' : ''}"><nav class="lj-map-point-groups" aria-label="分类组" data-map-point-scroll="groups"><span>选择分类</span>${scope.groups.map(item => `<button type="button" data-map-point-select-group="${item.id}" aria-pressed="${item.id === current.id}"><span>${esc(item.label)}</span><small>${groupCount(item)}</small></button>`).join('')}</nav>` +
      `<div class="lj-map-point-content"><div class="lj-map-point-select"><label for="lj-map-point-group-select">选择分类</label><select id="lj-map-point-group-select" data-map-point-group-select>${scope.groups.map(item => `<option value="${item.id}"${item.id === current.id ? ' selected' : ''}>${esc(item.label)}　${groupCount(item)}</option>`).join('')}</select></div>` +
      `<div class="lj-map-point-heading"><div><strong>${esc(query ? `“${mapPointView.query.trim()}”的分类结果` : current.label)}</strong><small>${query ? `共 ${items.length} 类 · 跨全部分类查找` : introductions ? `${current.categoryIds.length} 项 · 本组不设总名额` : `已显示 ${count(current)} / ${current.categoryIds.length} 类`}</small></div>${introductions ? `<div class="lj-peer-quota-legend" id="lj-peer-quota-limit-hint"><small>每行上限（默认 ${DEFAULT_PEER_PLACE_QUOTA}）</small><small>0＝不介绍 · 自动保存</small></div>` : query ? '' : `<div class="lj-map-point-actions">${mapPointButton('本组显示', `data-map-point-toggle-group="${current.id}" data-map-point-value="show"`)}${mapPointButton('本组隐藏', `data-map-point-toggle-group="${current.id}" data-map-point-value="hide"`)}</div>`}</div>` +
      `<div class="lj-map-point-results" data-map-point-scroll="categories" tabindex="0" aria-label="${introductions ? '分类介绍数量' : '分类开关'}列表"><div class="lj-map-point-grid">${items.length ? items.map(item => `<div class="lj-map-point-row"><span>${esc(item.label)}${introductions && metroParentIds.has(item.id) ? '<small>只管未归入子类的地点</small>' : ''}${query ? `<small>${esc(item.path)}</small>` : ''}</span>${introductions ? quotaControl(item) : `<button type="button" class="${switchClass(visibility[item.id])}" data-map-point-category="${item.id}" aria-label="在地图显示${esc(item.label)}" aria-pressed="${visibility[item.id]}"></button>`}</div>`).join('') : '<p class="lj-map-point-empty">没有找到相应分类，换个名称试试。</p>'}</div></div></div></div>`;
  }
  function rememberMapPointView() {
    content.querySelectorAll('[data-map-point-scroll]').forEach(node => { mapPointView.scrolls[node.dataset.mapPointScroll] = node.scrollTop; });
  }
  function restoreMapPointView() {
    content.querySelectorAll('[data-map-point-scroll]').forEach(node => { node.scrollTop = mapPointView.scrolls[node.dataset.mapPointScroll] || 0; });
  }
  function mapPointFocus() {
    const active = document.activeElement;
    if (!active || !content.contains(active)) return '';
    if (active.hasAttribute('data-peer-place-quota')) return `[data-peer-place-quota="${active.dataset.peerPlaceQuota}"]`;
    if (active.hasAttribute('data-place-category-mode')) return `[data-place-category-mode="${active.dataset.placeCategoryMode}"]`;
    return ['category', 'all', 'toggle-group', 'value', 'select-scope', 'select-group', 'group-select', 'search', 'clear-search']
      .filter(key => active.hasAttribute(`data-map-point-${key}`)).map(key => `[data-map-point-${key}="${active.getAttribute(`data-map-point-${key}`)}"]`).join('');
  }
  function refreshMapPointBrowser() {
    rememberMapPointView();
    mapPointView.scrolls.categories = 0;
    const focus = mapPointFocus(), visibility = mapPointVisibility(store.read().extensionUi?.mapPointVisibility);
    content.querySelector('[data-map-point-browser]').innerHTML = mapPointBrowserHtml(visibility);
    content.querySelector('[data-map-point-search]').value = mapPointView.query;
    content.querySelector('[data-map-point-clear-search]').hidden = !mapPointView.query;
    restoreMapPointView();
    if (focus) content.querySelector(focus)?.focus({ preventScroll: true });
  }
  function readingHtml() {
    const wrapperChoices = Object.entries(ui.engine.data.wrappers || {}).map(([id, value]) => [id, value.label || id]);
    const text = select('textScript', reading.textScript, [['simplified', '简体中文'], ['traditional', '繁體中文（港台）']], 'reading');
    const wrapper = select('wrapperMode', reading.wrapperMode, wrapperChoices, 'reading');
    const history = `<input${desktop ? '' : ' class="input grow"'} type="number" min="0" step="1" data-settings-reading="historyDepth" value="${esc(reading.historyDepth)}" aria-label="回看 AI 回复层数">`;
    const boundaries = [['start', '开始'], ['end', '结束']].map(([key, label]) => `<label>${label}<input${desktop ? '' : ' class="input"'} type="text" data-settings-boundary="${key}" value="${esc(reading.currentUserBoundary[key])}" aria-label="本轮输入${label}标签"></label>`).join('');
    const channels = CHANNELS.map(([key, name]) => `<section class="${desktop ? 'set12-channel' : mobile ? 'mobile-reading-channel' : 'settings-channel lj-settings-channel'}" id="lj-channel-${key}">${desktop ? `<h4>${name}</h4>` : `<b>${name}</b>`}${[['priority', '优先'], ['excluded', '排除']].map(([kind, label]) => `<label>${label}标签<input${desktop ? '' : ' class="input"'} type="text" data-settings-channel="${key}" data-tag-kind="${kind}" value="${esc(reading.channelTags[key][kind].join('、'))}" aria-label="${name}${label}标签"></label>`).join('')}</section>`).join('');
    if (desktop) return group('文字与读取范围', '变更后由底部统一保存',
      row('界面与新输出文字', text) + row('描写档位', wrapper) + row('回看 AI 回复层数', history) + row('本轮用户输入边界', `<div class="set12-boundary">${boundaries}</div>`, '开始与结束标签成对使用，或一起留空。')) +
      group('四条读取通道', '多个标签用顿号或逗号分隔', `<div class="set12-channelgrid">${channels}</div>`);
    const options = mobile ? `<div class="set-row"><div class="mobile-reading-options"><label>正文文字${text}</label><label>描写详略${wrapper}</label><label>回看 AI 层数${history}</label></div></div>` :
      row('正文文字与描写', text + wrapper) + row('回看 AI 回复层数', history, '0 表示不回看，由本组按钮统一保存。');
    return group('读取设置', '本组统一保存', options + `<div class="set-row"><div class="set-label"><b>本轮用户输入边界</b></div><div class="${mobile ? 'mobile-reading-boundary' : 'set-control lj-settings-boundary'}">${boundaries}</div></div><div class="set-row" id="settingsChannels"><div class="set-label"><b>四条读取通道</b></div><p>多个标签用顿号或逗号分隔。</p>${channels}</div>` + saveBar('reading'), 'settings-reading');
  }
  function favoritesHtml() {
    const rows = favorites.map((item, index) => {
      const name = `<input${desktop ? '' : ' class="input"'} type="text" data-favorite-index="${index}" data-favorite-field="displayName" value="${esc(item.displayName)}" aria-label="常用地点${index + 1}自定义名">`;
      const place = `<input${desktop ? '' : ' class="input"'} type="text" list="lj-favorite-results-${index}" data-favorite-index="${index}" data-favorite-field="name" value="${esc(item.name)}" aria-label="常用地点${index + 1}地点全名">`;
      return `<div class="${desktop ? 'set12-favorite' : 'v-favorite-setting'}">${desktop ? `<b>${index + 1}</b><label>自定义名${name}</label><label>地点全名${place}</label>` : name + place}</div><datalist id="lj-favorite-results-${index}"></datalist><div class="${desktop ? 'set12-control' : 'set-control'} lj-favorite-actions">${button('favorite-current', '使用当前地点', false, `data-index="${index}"`)}${button('favorite-clear', '清空', false, `data-index="${index}"`)}<span class="lj-meta" id="lj-favorite-hint-${index}">${item.entityId ? '已对应独立地点' : '尚未选择地点'}</span></div>`;
    }).join('');
    const note = '用于地图与路线的四个快捷位置，与地区页收藏分别保存。地点填写已有全名，自定义名建议五字以内。';
    if (desktop) return group('四个常用地点', '独立保存', `<p class="set12-favoritenote">${note}</p>${rows}${saveBar('favorites')}`);
    return group('四个常用地点', '独立保存', `<div class="set-row"><div class="v-favorite-labels"><span>自定义名</span><span>地点全名</span></div>${rows}<p>${note}</p></div>` + saveBar('favorites'), 'settings-places');
  }
  function placesHtml() {
    return group('地点分类', '按用途分别设置', mapPointsHtml(store.read().extensionUi?.mapPointVisibility)) + favoritesHtml();
  }
  function backupHtml() {
    const state = store.read(), overrides = ui.engine.normalizeTextOverrides(state.livingJapanTextOverrides);
    const library = state.materialLibrary || {};
    const materialCount = [['categories', '分类'], ['regions', '地域'], ['fragments', '片段'], ['places', '地点'], ['bindings', '挂接']].map(([key, label]) => `${Object.keys(library[key] || {}).length} ${label}`).join(' · ');
    const placeEdits = state.placeEdits || {};
    const backupNote = `完整用户备份包含地点个人修改、自建地点、正文修改稿与空位、资料词条、收藏与隐藏，以及全部设置；不包含内置资料。当前地点修改 ${Object.keys(placeEdits.overrides || {}).length} 处，自建地点 ${Object.keys(placeEdits.created || {}).length} 处。资料登记：${materialCount}。`;
    const file = '<input type="file" accept="application/json,.json" data-settings-file hidden>';
    const download = backupDownload ? `<a class="lj-update-link" data-settings-backup-download href="${esc(backupDownload.url)}" download="${esc(backupDownload.filename)}">保存备份文件</a>` : '';
    const exportControls = button('export', '导出用户备份') + download;
    const updateButtons = button('check-update', '检查程序更新') + button('update', '更新程序', false, !updateResult?.available ? 'disabled' : '');
    const programRow = row('程序框架', '<div class="lj-update-controls"><p class="lj-update-line" data-program-update-note role="status"></p><div class="lj-update-actions">' + updateButtons + '</div></div>');
    const packageRow = ui.bridge.packages ? row('地区资料', '<div class="lj-update-controls"><p class="lj-update-line" data-package-update-note role="status"></p><div class="lj-update-actions">' + button('check-pack-updates', '检查资料更新') + button('region-packs', '地区资料包') + button('update-log', '更新记录') + '</div><div class="lj-update-copy"><p class="lj-update-small" data-update-summary></p><p class="lj-update-small" data-update-notice></p></div></div>') : '';
    const chapterSelect = (chapters, attribute, label) => `<select ${attribute} aria-label="${label}">${chapters.map(({id,label}) => `<option value="${esc(id)}">${esc(label)}</option>`).join('')}</select>`;
    const workflowControls = button('workflow-all', '从头看完整流程', true) + `<div class="lj-update-actions">${chapterSelect(WORKFLOW_CHAPTERS, 'data-workflow-chapter', '选择流程章节')}${button('workflow-chapter', '看这一章')}</div>`;
    const pageGuideControls = `<div class="lj-update-actions">${chapterSelect(GUIDE_CHAPTERS, 'data-page-guide-chapter', '选择页面讲解')}${button('guide-page', '讲解这一页')}</div>` + button('guide-all', '顺读全部页面讲解');
    const guideRows = row('完整流程演示', workflowControls, '用示例带你完成操作，自动打开页面、保存并展示结果。原工作内容保留；章内按上一步、下一步看。') + row('页面讲解 · 查按钮用途', pageGuideControls, '保留原来的界面讲解。在你的当前页面旁解释按钮，适合忘记用法时查阅。');
    const orphanList = `<ul>${Object.entries(overrides.orphans).map(([key, item]) => `<li>${esc(item.packageId || key)} · ${esc(key)}</li>`).join('')}</ul>`;
    if (desktop) return group('用户资料备份', `${Object.keys(overrides.records).length} 段修改稿 · ${Object.keys(overrides.orphans).length} 段未对应`, row('导出用户备份', `<div class="lj-update-actions">${exportControls}</div>`, backupNote) + row('导入用户备份', button('import', '导入备份') + file, '导入前先预览将要合并和覆盖的内容。')) +
      group('扩展更新', '保留用户保存', programRow + packageRow) +
      group('使用说明与操作引导', '完整演示与按页查阅', guideRows) +
      (Object.keys(overrides.orphans).length ? group('未对应旧稿', '仍在备份中保留', `<div class="set12-guide">${orphanList}</div>`) : '');
    return group('备份与说明', '低频入口', row('用户资料备份', `<div class="lj-update-actions">${exportControls}${button('import', '导入备份')}${file}</div>`, backupNote) +
      programRow + packageRow + guideRows + (Object.keys(overrides.orphans).length ? `<div class="set-row"><div class="set-label"><b>未对应旧稿</b></div><p>仍在备份中保留。</p>${orphanList}</div>` : ''), 'settings-backup');
  }
  function patchUpdateStatus() {
    const header = document.getElementById(desktop ? 'set12Headnote' : 'lj-settings-status');
    if (header) {
      if (packUpdates.available || updateResult?.available) {
        if (!header.querySelector('[data-settings-action="open-update-section"]')) header.innerHTML = '<button type="button" class="lj-update-link" data-settings-action="open-update-section">有可用更新</button>';
        header.hidden = false;
      } else {
        header.textContent = desktop ? TAB_NOTES[tab] : status || TAB_NOTES[tab];
      }
    }
    const put = (selector, text) => { const node = content.querySelector(selector); if (node) node.textContent = text; };
    const programNote = updateResult?.checking ? '正在检查程序更新…' : updateResult?.error ? '程序更新检查未完成，请重试。' : updateResult?.reloadRequired ? '程序已更新，刷新页面后应用。' : updateResult?.supported === false ? '当前安装不支持内部更新，请用原安装方式更新程序。' : updateResult?.available ? '有可用程序更新' : updateResult?.supported ? '程序已是最新版本' : '通过酒馆检查程序更新';
    const programVersion = updateVersion(updateResult?.version);
    put('[data-program-update-note]', programNote + (programVersion ? ` · 当前版本 ${programVersion}` : ''));
    const programCheck = content.querySelector('[data-settings-action="check-update"]'), programInstall = content.querySelector('[data-settings-action="update"]');
    if (programCheck) programCheck.disabled = Boolean(updateResult?.checking);
    if (programInstall) programInstall.disabled = !updateResult?.available;
    const parts = packUpdates.items || [];
    let packNote = packUpdates.checking ? '正在检查资料更新…' : packUpdates.error ? '资料更新检查未完成，请重试。' : packUpdates.available ? parts.map(item => `${item.name || '地区资料'} · ${updateVersion(item.version) ? `版本 ${updateVersion(item.version)} · ` : ''}本次下载 ${updateBytes(item.downloadBytes)}`).join('；') : packUpdates.checkedAt ? '已安装资料已是最新版本' : '检查已安装地区资料的更新';
    put('[data-package-update-note]', packNote);
    const packageCheck = content.querySelector('[data-settings-action="check-pack-updates"]'); if (packageCheck) packageCheck.disabled = Boolean(packUpdates.checking);
    put('[data-update-summary]', updateText(packUpdates.changelog?.[0]?.summary));
    put('[data-update-notice]', updateText(packUpdates.notice));
  }
  function closeUpdateLog() {
    if (!updateLog) return;
    updateLog.close?.(); updateLog.remove(); updateLog = null; logFocus?.focus?.();
  }
  function openUpdateLog() {
    closeUpdateLog(); logFocus = document.activeElement;
    const dialog = document.createElement('dialog'); updateLog = dialog;
    dialog.className = 'lj-dialog lj-update-log'; dialog.setAttribute('aria-labelledby', 'lj-update-log-heading');
    const records = packUpdates.changelog || [];
    const note = packUpdates.notice ? `<section><h4>作者通知</h4><p>${esc(updateText(packUpdates.notice))}</p></section>` : '';
    dialog.innerHTML = `<header><h3 id="lj-update-log-heading">更新记录</h3><button type="button" class="lj-button" data-update-log-close aria-label="关闭更新记录">关闭</button></header><div class="lj-update-log-body">${note}${records.length ? records.map(record => `<article><h4>${esc(updateVersion(record.version) ? `版本 ${updateVersion(record.version)}` : '资料更新')}</h4><p>${esc(updateText(record.summary))}</p>${record.details ? `<details><summary>完整说明</summary><p>${esc(updateText(record.details))}</p></details>` : ''}</article>`).join('') : '<p>暂无更新记录</p>'}</div>`;
    dialog.addEventListener('click', event => { if (event.target.closest('[data-update-log-close]')) closeUpdateLog(); });
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeUpdateLog(); });
    document.body.append(dialog); dialog.showModal(); dialog.querySelector('[data-update-log-close]')?.focus();
  }
  function openTab(value, channel) {
    rememberScroll();
    tab = value === 'places' ? 'favorites' : value;
    if (!TABS.some(([id]) => id === tab)) tab = 'common';
    render(true);
    if (channel) document.getElementById(`lj-channel-${channel}`)?.scrollIntoView({ block: 'nearest' });
  }
  function openUpdateSection() {
    openTab('backup');
    content.querySelector(packUpdates.available ? '[data-package-update-note]' : '[data-program-update-note]')?.scrollIntoView({ block: 'center' });
  }
  const heading = document.getElementById('set12Headnote');
  const headingClick = event => { if (event.target.closest('[data-settings-action="open-update-section"]')) openUpdateSection(); };
  heading?.addEventListener('click', headingClick);
  function render(force = false) {
    if (!force && content.contains(document.activeElement) && (readingDirty || favoritesDirty || quotaDrafts.size)) return;
    rememberMapPointView();
    const mapFocus = mapPointFocus();
    initDrafts();
    tabs.innerHTML = TABS.map(([id, label]) => `<button type="button" data-lj-settings-tab="${id}" class="${tab === id ? 'on' : ''}" aria-pressed="${tab === id}">${label}</button>`).join('');
    const note = document.getElementById('set12Headnote');
    if (note) note.textContent = TAB_NOTES[tab];
    const page = tab === 'common' ? commonHtml() : tab === 'reading' ? readingHtml() : tab === 'favorites' ? placesHtml() : backupHtml();
    if (desktop) content.innerHTML = `<div class="set12-scroll"><p class="lj-status ${tone}" role="status" id="lj-settings-status"${status ? '' : ' hidden'}>${esc(status)}</p>${page}</div>${tab === 'reading' ? saveBar(tab) : ''}`;
    else content.innerHTML = `<div class="settings-status ${tone}" role="status" id="lj-settings-status">${esc(status || TAB_NOTES[tab])}</div>${page}`;
    scroller().scrollTop = scrolls[tab] || 0;
    restoreMapPointView();
    if (mapFocus) content.querySelector(mapFocus)?.focus({ preventScroll: true });
    content.querySelectorAll('button,select,input').forEach(node => { if (busy) node.disabled = true; });
    patchUpdateStatus();
  }
  function message(text, type = '') {
    status = text; tone = type;
    const target = document.getElementById('lj-settings-status');
    if (target) { target.textContent = text; target.className = `${desktop ? 'lj-status' : 'settings-status'} ${type}`; target.hidden = false; }
    ui.notify(text, type);
  }
  function clearBackupDownload() {
    if (!backupDownload) return;
    URL.revokeObjectURL(backupDownload.url);
    backupDownload = null;
  }
  async function saving(operation, success) {
    if (busy) return false;
    rememberScroll();
    busy = true;
    try { await operation(); await session.refresh(); message(success, 'success'); return true; }
    catch (error) { message(error.message || String(error), 'error'); return false; }
    finally { busy = false; render(true); }
  }
  async function saveReading() {
    if (!Number.isFinite(reading.historyDepth) || reading.historyDepth < 0 || !Number.isInteger(reading.historyDepth)) { message('回看层数请填写0或正整数', 'error'); return false; }
    if (Boolean(reading.currentUserBoundary.start.trim()) !== Boolean(reading.currentUserBoundary.end.trim())) { message('本轮输入的开始与结束标签请成对填写，或一起留空', 'error'); return false; }
    return saving(async () => { await session.runtime.saveSettings({ ...store.read().livingJapanSettings, ...clone(reading) }); readingDirty = false; }, '读取设置已保存');
  }
  async function saveFavorites() {
    const unmatched = favorites.find(item => item.name.trim() && !item.entityId);
    if (unmatched) { message(`“${unmatched.name}”尚未对应唯一地点，请先选择明确地点`, 'error'); return false; }
    return saving(async () => { await store.update(draft => { draft.extensionUi ||= {}; draft.extensionUi.favorites = clone(favorites); }); favoritesDirty = false; }, '四个常用地点已保存');
  }
  function savePeerQuota(id) {
    quotaSaveQueue = quotaSaveQueue.then(() => commitPeerQuota(id));
    return quotaSaveQueue;
  }
  async function commitPeerQuota(id) {
    if (!quotaDrafts.has(id)) return true;
    const raw = quotaDrafts.get(id).trim(), value = Number(raw);
    if (!raw || !Number.isSafeInteger(value) || value < 0) {
      quotaErrors.add(id); render(true); message('介绍数量请填写 0 或正整数；当前输入已保留', 'error'); return false;
    }
    return saving(async () => {
      await session.runtime.saveSettings({ ...settings(), peerPlaceQuotas: { ...peerQuotas(), [id]: value } });
      if (quotaDrafts.get(id)?.trim() === raw) { quotaDrafts.delete(id); quotaErrors.delete(id); }
    }, '同级介绍数量已保存');
  }
  async function requestLeave() {
    await quotaSaveQueue;
    if (!readingDirty && !favoritesDirty && !quotaDrafts.size) return true;
    rememberScroll();
    const choice = await ui.ask({ title: '设置尚未保存', message: '读取设置、常用地点或介绍数量有尚未保存的输入。', choices: [{ id: 'save', label: '保存并继续', primary: true }, { id: 'discard', label: '不保存并继续' }, { id: 'cancel', label: '留在设置' }] });
    if (choice === 'save') { for (const id of quotaDrafts.keys()) if (!(await savePeerQuota(id))) return false; if (readingDirty && !(await saveReading())) return false; if (favoritesDirty && !(await saveFavorites())) return false; return true; }
    if (choice === 'discard') { readingDirty = favoritesDirty = false; quotaDrafts.clear(); quotaErrors.clear(); initDrafts(); render(true); return true; }
    return false;
  }
  function markDraft(kind) {
    if (kind === 'reading') readingDirty = true; else favoritesDirty = true;
    const node = content.querySelector(`[data-settings-dirty="${kind}"]`);
    if (node) { node.textContent = kind === 'reading' ? '读取设置尚未保存' : '常用地点尚未保存'; node.classList.add('dirty'); }
  }
  async function searchFavorite(index, name) {
    const ticket = Symbol(); favoriteQueries.set(index, ticket);
    const found = name.trim() ? await catalog.search(name.trim(), { regionCode: ui.state.regionCode || '13', limit: 100 }) : [];
    if (favoriteQueries.get(index) !== ticket) return;
    favoriteMatches.set(index, found);
    const list = document.getElementById(`lj-favorite-results-${index}`);
    if (list) list.innerHTML = [...new Set(found.map(item => item.name))].map(value => `<option value="${esc(value)}"></option>`).join('');
    const exact = found.filter(item => item.name === name.trim());
    if (exact.length === 1) Object.assign(favorites[index], { entityId: exact[0].id, regionCode: exact[0].regionCode || ui.state.regionCode });
    const hint = document.getElementById(`lj-favorite-hint-${index}`);
    if (hint) hint.textContent = exact.length === 1 ? '已对应独立地点' : exact.length > 1 ? '同名地点不唯一，请在地区或地图选中后使用当前地点' : '请填写已收录全名，或使用当前地点';
  }
  tabs.addEventListener('click', event => {
    const target = event.target.closest('[data-lj-settings-tab]'); if (!target) return;
    openTab(target.dataset.ljSettingsTab);
  });
  content.addEventListener('input', event => {
    const input = event.target;
    if (input.hasAttribute('data-peer-place-quota')) { quotaDrafts.set(input.dataset.peerPlaceQuota, input.value); quotaErrors.delete(input.dataset.peerPlaceQuota); return; }
    if (input.hasAttribute('data-map-point-search')) { mapPointView.query = input.value; refreshMapPointBrowser(); return; }
    if (input.dataset.settingsReading) { const key = input.dataset.settingsReading; reading[key] = key === 'historyDepth' ? Number(input.value) : input.value; markDraft('reading'); }
    if (input.dataset.settingsBoundary) { reading.currentUserBoundary[input.dataset.settingsBoundary] = input.value; markDraft('reading'); }
    if (input.dataset.settingsChannel) { reading.channelTags[input.dataset.settingsChannel][input.dataset.tagKind] = splitTags(input.value); markDraft('reading'); }
    if (input.dataset.favoriteField) {
      const index = Number(input.dataset.favoriteIndex); favorites[index][input.dataset.favoriteField] = input.value;
      if (input.dataset.favoriteField === 'name') { favorites[index].entityId = ''; favorites[index].regionCode = ''; searchFavorite(index, input.value).catch(error => message(error.message, 'error')); }
      markDraft('favorites');
    }
  });
  async function commonChange(key, value) {
    if (key === 'layout') { if (await requestLeave()) await ui.bridge.setLayout(value); return; }
    const succeeded = await saving(async () => {
      if (key === 'theme' || key === 'pinned') await store.update(draft => { draft.extensionUi ||= {}; draft.extensionUi[key] = value; });
      else { const next = ui.engine.normalizeSettings(store.read().livingJapanSettings); if (key.startsWith('layer:')) next.layers[key.slice(6)] = value; else next[key] = value; await session.runtime.saveSettings(next); }
    }, '常用设置已保存');
    if (key === 'theme' && succeeded) document.body.dataset.theme = value === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day') : value;
  }
  content.addEventListener('change', async event => {
    const input = event.target;
    if (input.hasAttribute('data-peer-place-quota')) { await savePeerQuota(input.dataset.peerPlaceQuota); return; }
    if (input.hasAttribute('data-map-point-group-select')) { mapPointView.groups[mapPointView.scope] = input.value; refreshMapPointBrowser(); try { await persistCategoryView(); } catch (error) { message(error.message, 'error'); } return; }
    if (input.matches('select[data-settings-common]')) { try { await commonChange(input.dataset.settingsCommon, input.value); } catch (error) { message(error.message, 'error'); } }
    if (!input.matches('[data-settings-file]')) return;
    const file = input.files?.[0]; input.value = ''; if (!file) return;
    try {
      const preview = store.importBackup(await file.text()), s = preview.summary;
      const placeChanges = s.placeEditsAdded || s.placeEditsOverwritten || s.placesCreatedAdded || s.placesCreatedOverwritten
        ? `地点个人修改新增 ${s.placeEditsAdded || 0} 处、覆盖 ${s.placeEditsOverwritten || 0} 处；自建地点新增 ${s.placesCreatedAdded || 0} 处、覆盖 ${s.placesCreatedOverwritten || 0} 处。` : '';
      const slotChanges = s.customSlotsAdded || s.customSlotsOverwritten
        ? `自建正文空位新增 ${s.customSlotsAdded} 个、覆盖 ${s.customSlotsOverwritten} 个。` : '';
      const choice = await ui.ask({ title: '导入用户备份', message: `新增 ${s.added} 段，覆盖 ${s.overwritten} 段，未对应 ${s.unresolved} 段；${s.baseChanged} 段的原文基准有变化。${s.unresolved ? '未对应正文会保留。' : ''}${placeChanges}${slotChanges}${s.materialLibraryIncluded ? `资料登记新增 ${s.materialRecordsAdded} 条，覆盖 ${s.materialRecordsOverwritten} 条（分类、地域、片段、地点及挂接）。` : ''}${s.settingsIncluded ? '此备份还会合并开关和个人偏好。' : ''}`, choices: [{ id: 'cancel', label: '取消' }, { id: 'import', label: '确认导入', primary: true }] });
      if (choice === 'import') await saving(() => store.applyImport(preview), s.settingsIncluded ? '用户备份已导入并读回确认。布局和窗口位置等偏好刷新网页后生效。' : '用户备份已导入并读回确认');
    } catch (error) { message(error.message, 'error'); }
  });
  content.addEventListener('click', async event => {
    const panel = event.target.closest('[data-place-category-mode]');
    if (panel) {
      rememberScroll(); rememberMapPointView(); mapPointView.mode = panel.dataset.placeCategoryMode; render(true);
      try { await persistCategoryView(); } catch (error) { message(error.message, 'error'); } return;
    }
    const mapNavigation = event.target.closest('[data-map-point-select-scope],[data-map-point-select-group],[data-map-point-clear-search]');
    if (mapNavigation) {
      if (mapNavigation.dataset.mapPointSelectScope) { mapPointView.scope = mapNavigation.dataset.mapPointSelectScope; mapPointView.query = ''; }
      if (mapNavigation.dataset.mapPointSelectGroup) mapPointView.groups[mapPointView.scope] = mapNavigation.dataset.mapPointSelectGroup;
      if (mapNavigation.hasAttribute('data-map-point-clear-search')) mapPointView.query = '';
      refreshMapPointBrowser();
      if (mapNavigation.hasAttribute('data-map-point-clear-search')) content.querySelector('[data-map-point-search]').focus({ preventScroll: true });
      if (!mapNavigation.hasAttribute('data-map-point-clear-search')) try { await persistCategoryView(); } catch (error) { message(error.message, 'error'); }
      return;
    }
    const mapControl = event.target.closest('[data-map-point-category],[data-map-point-toggle-group],[data-map-point-all]');
    if (mapControl) {
      event.preventDefault();
      const ids = mapControl.dataset.mapPointCategory ? [mapControl.dataset.mapPointCategory] : mapControl.dataset.mapPointToggleGroup ? activeMapGroup().categoryIds : mapPointCategories.map(item => item.id);
      await saving(() => store.update(draft => {
        draft.extensionUi ||= {};
        const visibility = normalizeMapPointVisibility(draft.extensionUi.mapPointVisibility);
        const action = mapControl.dataset.mapPointAll || mapControl.dataset.mapPointValue;
        const show = action ? action === 'show' : !ids.every(id => visibility[id] !== false);
        ids.forEach(id => visibility[id] = show);
        draft.extensionUi.mapPointVisibility = visibility;
      }), '地图兴趣点显示已保存');
      return;
    }
    const common = event.target.closest('button[data-settings-common]');
    if (common) { await commonChange(common.dataset.settingsCommon, common.dataset.settingsValue ?? (common.getAttribute('aria-pressed') !== 'true')); return; }
    const target = event.target.closest('[data-settings-action]'); if (!target || busy) return;
    const action = target.dataset.settingsAction;
    try {
      if (action === 'save-reading') {
        await saveReading();
      } else if (action === 'save-favorites') {
        await saveFavorites();
      } else if (action === 'favorite-current') {
        const entity = ui.state.selected; if (!entity?.id) throw new Error('请先在地图或地区选择地点');
        rememberScroll();
        Object.assign(favorites[Number(target.dataset.index)], { entityId: entity.id, name: entity.name, regionCode: entity.regionCode || ui.state.regionCode }); markDraft('favorites'); render(true);
      } else if (action === 'favorite-clear') {
        rememberScroll();
        Object.assign(favorites[Number(target.dataset.index)], { entityId: '', name: '', displayName: '', regionCode: '' }); markDraft('favorites'); render(true);
      } else if (action === 'export') {
        // LJ-BACKUP-DOWNLOAD-20261103: keep the generated snapshot available for a manual retry.
        const url = URL.createObjectURL(new Blob([store.exportBackup()], { type: 'application/json;charset=utf-8' }));
        clearBackupDownload();
        backupDownload = { url, filename: `Living-Japan-用户备份-${new Date().toISOString().slice(0, 10)}.json` };
        rememberScroll(); render(true);
        content.querySelector('[data-settings-backup-download]')?.click();
        message('备份已生成。如果浏览器没有下载，可点“保存备份文件”重试。');
      } else if (action === 'import') content.querySelector('[data-settings-file]').click();
      else if (action === 'region-packs') { await ui.bridge.openPackages(); }
      else if (action === 'open-update-section') { openUpdateSection(); }
      else if (action === 'check-pack-updates') { await packManager?.refreshCatalog(); packUpdates = packManager?.getUpdateSummary?.() || packUpdates; patchUpdateStatus(); }
      else if (action === 'update-log') { openUpdateLog(); }
      else if (action === 'check-update') { if (!updates) throw new Error('当前预览未连接酒馆更新接口'); updateResult = await updates.check(); patchUpdateStatus(); }
      else if (action === 'update') {
        const choice = await ui.ask({ title: '更新扩展', message: '更新程序框架，用户保存保留。更新后需刷新，当前未保存输入请先处理。', choices: [{ id: 'cancel', label: '取消' }, { id: 'update', label: '开始更新', primary: true }] });
        if (choice === 'update') { target.disabled = true; const result = await updates.update(); message(result.reloadRequired ? '扩展已更新；保存当前输入后刷新页面应用' : '当前扩展已是最新版'); updateResult = updates.getState?.() || { supported: true, available: false, reloadRequired: result.reloadRequired }; patchUpdateStatus(); }
      } else if (action.startsWith('workflow-')) {
        await ui.bridge.workflowTour?.start(action === 'workflow-all' ? 'all' : content.querySelector('[data-workflow-chapter]').value);
      } else if (action.startsWith('guide-')) {
        await ui.guide.start(action === 'guide-page' ? content.querySelector('[data-page-guide-chapter]').value : action.slice(6));
      }
    } catch (error) { message(action.includes('update') ? '更新检查或下载未完成，请重试。' : error.message || String(error), 'error'); }
  });
  let observedWrapperMode = settings().wrapperMode;
  const unsubscribeLocationInput = ui.bridge.subscribe?.(() => {
    const current = settings(), on = current.skipUserLocationInput === true;
    content.querySelectorAll('[data-settings-common="skipUserLocationInput"]').forEach(node => {
      node.setAttribute('aria-pressed', String(on)); node.classList.toggle('on', on);
    });
    if (current.wrapperMode !== observedWrapperMode) {
      observedWrapperMode = current.wrapperMode;
      if (reading) {
        reading.wrapperMode = current.wrapperMode;
        readingDirty = READING_KEYS.some(key => JSON.stringify(reading[key]) !== JSON.stringify(current[key]));
        content.querySelectorAll('[data-settings-reading="wrapperMode"]').forEach(node => { node.value = current.wrapperMode; });
        const note = content.querySelector('[data-settings-dirty="reading"]');
        if (note) { note.textContent = readingDirty ? '读取设置尚未保存' : '当前没有待保存修改'; note.classList.toggle('dirty', readingDirty); }
      }
    }
  });
  const unsubscribePackUpdates = packManager?.subscribeUpdates?.(value => { packUpdates = value; patchUpdateStatus(); });
  const unsubscribeProgramUpdates = updates?.subscribe?.(value => { updateResult = value; patchUpdateStatus(); });
  function destroy() { clearBackupDownload(); unsubscribeLocationInput?.(); unsubscribePackUpdates?.(); unsubscribeProgramUpdates?.(); heading?.removeEventListener('click', headingClick); closeUpdateLog(); }
  document.defaultView?.addEventListener('unload', destroy, { once: true });
  render();
  return { render, requestLeave, openTab, destroy, hasUnsaved: () => readingDirty || favoritesDirty || quotaDrafts.size > 0 };
}
