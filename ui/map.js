import { createNationalMap } from '../src/national-map.js';
import { createPlaceSummary } from './place-summary.js';
import { mountMapSplitter } from './map-splitter.js';
import { loadTransitService } from '../src/transit-service.js';
import { createSearchResultItem } from '../src/search-result.js';
import { injectionEndpoints } from '../src/injection-names.js';
import { navigationCoordinates } from '../src/living-area-map.js';

// LJ-EXT-MAP: frozen layout controls share real selection, map layers and v3.6 trip estimates.
const MODES = [['schem', '示意'], ['map', '地图'], ['detail', '精细'], ['ultra', '超精细']];
const MODE_HELP = { schem: '重点铁路、大地区与少量标志', map: '大地区与地理轮廓', detail: '大地区；放大查看精选地点和车站', ultra: '地区文字；近景展开分类场所' };
const TRAVEL = [['public_transit', '公共交通'], ['driving', '驾车'], ['walking', '步行'], ['bicycle', '自行车']];
const MODE_IDS = { transit: 'public_transit', drive: 'driving', walk: 'walking', bike: 'bicycle', '公共交通': 'public_transit', '驾车': 'driving', '步行': 'walking', '自行车': 'bicycle' };
const administrative = entity => !entity || ['country', 'prefecture', 'city', 'ward', 'town', 'village', 'administrative', 'region'].includes(entity.kind) || entity.id?.startsWith('admin:') || entity.source?.namespace === 'administration';
const coordinates = point => Array.isArray(point) ? { longitude: point[0], latitude: point[1] } : point;

export function createRelatedSelection(load, onChange, onError = () => {}) {
  let selectedId = null, selectedRevision, epoch = 0, rows = [], dead = false;
  return {
    rows: () => rows,
    select(entity, revision) {
      if (dead || (entity?.id || null) === selectedId && revision === selectedRevision) return;
      selectedId = entity?.id || null; selectedRevision = revision; rows = []; const token = ++epoch;
      if (!entity) return;
      Promise.resolve(load(entity)).then(value => { if (!dead && token === epoch) { rows = value; onChange(rows); } }, error => { if (!dead && token === epoch) onError(error); });
    },
    destroy() { dead = true; ++epoch; rows = []; },
  };
}

export function nextEndpoints(origin, destination, kind, entity) {
  if (kind === 'origin') return { origin: origin?.id === entity.id ? null : entity, destination: destination?.id === entity.id ? null : destination };
  return { origin: origin?.id === entity.id ? null : origin, destination: destination?.id === entity.id ? null : entity };
}

export function toTransitEndpoint(entity, data, fields) {
  if (administrative(entity)) return null;
  const placeId = entity.legacyPlaceId || entity.id;
  const place = data.places.find(item => item.placeId === placeId);
  const crosswalk = (data.stationAdministration?.contentStationCrosswalk || []).find(item => item.placeId === placeId);
  const railId = crosswalk?.railStationId || (placeId.startsWith('place:rail_station:') ? placeId.slice(19) : null);
  const stationId = railId || place?.railStationId || place?.mapStationId || place?.stationId;
  const station = fields.transitTime.stationAnchors.find(item => [item.stationId, item.railStationId, item.mapStationId, ...(item.aliases || [])].includes(stationId));
  const areaId = place?.editorialAreaIds?.[0];
  const area = fields.transitTime.areaAnchors.find(item => item.areaId === areaId);
  if (station && (place?.kind === 'station' || railId)) { const name = station.nameJa || station.label || entity.name; return { type: 'station', id: station.stationId, label: /[站駅]$/.test(name) ? name : name + '駅', stationIds: [station.stationId], regionId: station.regionId, coordinates: { longitude: station.longitude, latitude: station.latitude } }; }
  const point = coordinates(navigationCoordinates(entity) || place?.coordinates) || (area ? { longitude: area.longitude, latitude: area.latitude } : null);
  if (!point || !Number.isFinite(point.longitude) || !Number.isFinite(point.latitude)) return null;
  return { type: place?.sourceObjectId ? 'object' : place?.kind === 'editorial_area' ? 'area' : 'place', id: place?.sourceObjectId || (place?.kind === 'editorial_area' ? areaId : placeId), label: place?.label || entity.name || placeId, areaId: areaId || null, regionId: place?.regionId || area?.regionId || '', stationIds: area?.stationIds || [], coordinates: point };
}

export function mountMap(ui) {
  const { bridge, state, esc } = ui, { catalog } = bridge, desktop = ui.layout === 'desktop';
  const $ = selector => document.querySelector(selector), $$ = selector => [...document.querySelectorAll(selector)];
  const local = state.mapUi ||= { mode: 'detail', full: false, details: true, query: '', history: [] };
  local.mode ||= 'detail'; local.history ||= []; local.stash ||= []; local.menu = ''; state.regionCode ||= 'metro';
  local.regionCode ||= state.mapView?.regionCode || 'metro';
  let renderedQuery = '', splitter;
  let map, mounting, suppressSelection = false, dead = false, timer = null, searchEpoch = 0, searchPageRequest = 0, composingInput = null, routeEpoch = 0, transitPromise, routeKey = '', estimates = {}, routeStatus = '', selectedEndpoints = null;
  let searchState = { query: '', queryId: null, result: null, progress: null, busy: false, paging: false, counts: {} };
  const entities = new Map(), renderedSearchRows = new WeakMap(), hosts = desktop ? [$('.map7')] : [$('#mapCanvas'), $('#fullMapCanvas')];
  const surface = document.createElement('div'); surface.className = 'lj-map-surface'; surface.style.position = 'absolute'; if (desktop) surface.style.right = 'var(--edge,0px)';
  const remember = entity => { if (entity?.id) entities.set(entity.id, entity); return entity; };
  const current = () => state.selected || catalog.get(state.selectedId) || null;
  const resolve = async id => entities.get(id) || catalog.get(id) || await catalog.resolve(id, { regionCode: local.regionCode });
  const attr = entity => `data-map-entity="${esc(entity.id)}"`;
  // LJ-APPROVED-MAP-CONTROLS-20261030: keep final showcase button structures around the live actions.
  const action = (name, text, entity = null, extra = '') => `<button type="button" data-lj-map="${name}" ${entity ? attr(entity) : ''} ${extra}>${esc(text)}</button>`;
  const pin = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.1 7-12A7 7 0 1 0 5 9c0 5.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.3"/></svg>';
  const locateButton = (entity, className, disabled = false) => `<button type="button" class="${className}" data-lj-map="locate" ${entity ? attr(entity) : ''} ${disabled ? 'disabled' : ''} aria-label="只定位${esc(entity?.name || '当前地点')}" title="只移动地图，不替换当前地点">${pin}</button>`;
  const run = operation => Promise.resolve().then(operation).catch(error => ui.notify(error.message, 'error'));
  // LJ-MAP-ADMIN-PATH-20261030: administrative selection remains available independently of text bodies.
  const adminMarkup = entity => {
    if (!entity) return '地图与地点搜索';
    const nodes = (entity.adminNodes || []).filter(node => node.id !== 'admin:jp' && (node.label || node.name || node.nameJa));
    return `<span>${esc(entity.displayType || entity.type || '地点')}</span>${nodes.length ? '<span> · </span>' : ''}${nodes.map(node => `<button type="button" data-admin-target="${esc(node.id)}" data-lj-map="choose" data-map-entity="${esc(node.id)}">${esc(node.label || node.name || node.nameJa)}</button>`).join('<span> › </span>')}`;
  };
  const summarize = createPlaceSummary(ui), summary = entity => summarize(entity).text;
  function favorites() {
    const data = bridge.store.read(), source = data.extensionUi?.favorites || data.livingJapanUIPreferences?.transitFavoritePlaces?.slots || [];
    return Array.from({ length: 4 }, (_, index) => {
      const value = source[index] || {}, oldId = value.endpoint?.id;
      const old = oldId && (catalog.get(oldId) || catalog.get(`place:station:${oldId}`) || catalog.get(`place:content_object:${oldId}`));
      return { ...value, entityId: value.entityId || old?.id, name: value.name || old?.name, displayName: value.displayName || `常用${index + 1}` };
    });
  }
  // LJ-MAP-REGIONS-8: browse groups leave prefecture identities and map views unchanged.
  const regionOptions = () => {
    const regions = catalog.regions(), groups = new Map();
    const option = region => `<option value="${esc(region.code)}" ${String(region.code) === local.regionCode ? 'selected' : ''}>${esc(region.name || region.label || region.code)}${region.available===false?' · 未载入':''}</option>`;
    const views = ['metro', '00'].map(code => regions.find(region => String(region.code) === code)).filter(Boolean);
    const remaining = regions.filter(region => !['metro', '00'].includes(String(region.code)));
    for (const region of remaining) {
      if (!region.groupId) continue;
      if (!groups.has(region.groupId)) groups.set(region.groupId, { name: region.groupName, regions: [] });
      groups.get(region.groupId).regions.push(region);
    }
    return views.map(option).join('') + [...groups.values()].map(group => `<optgroup label="${esc(group.name)}">${group.regions.map(option).join('')}</optgroup>`).join('') + remaining.filter(region => !region.groupId).map(option).join('');
  };
  function searchMarkup() {
    return `<div class="search-float"><div class="search"><span>⌕</span><input class="search-input" data-map-query type="search" placeholder="搜索名称或类型" aria-label="搜索地图地点" autocomplete="off"><button type="button" class="v-map-search-exit" data-lj-map="exit-search" aria-label="退出搜索" hidden>×</button><select data-map-region class="lj-select" style="max-width:88px;font-size:12px" aria-label="地图地区">${regionOptions()}</select></div><div class="search-results" data-map-results hidden></div><div class="search-history" data-map-history hidden></div></div><div class="fav" data-map-favorites></div><div class="level" data-expanded="${local.full}" data-map-level-control>${MODES.map(([id, name]) => `<button type="button" data-lj-map="mode" data-map-mode="${id}">${name}</button>`).join('')}</div><div class="zoom"><button type="button" data-lj-map="zoom-in" aria-label="放大">＋</button><button type="button" data-lj-map="zoom-out" aria-label="缩小">−</button><button type="button" data-lj-map="fit" title="只复原地图视野" aria-label="只复原地图视野">◎</button></div>`;
  }
  function prepare() {
    if (desktop) {
      $('.map7 .map-art7')?.remove(); $('.map7')?.prepend(surface);
      const input = $('#search7'); input.dataset.mapQuery = ''; input.placeholder = '搜索名称或类型';
      $('.search7 .scope7').innerHTML = `<button type="button" data-lj-map="exit-search" aria-label="退出地点搜索" hidden>×</button><select data-map-region class="lj-select" style="max-width:110px" aria-label="地图地区">${regionOptions()}</select>`;
      $('.recent7').dataset.mapHistory = ''; $('.fav7').dataset.mapFavorites = '';
      $$('.density7 button').forEach((node, index) => { node.dataset.ljMap = 'mode'; node.dataset.mapMode = MODES[index][0]; });
      $$('.zoom7 button').forEach((node, index) => node.dataset.ljMap = ['zoom-in', 'zoom-out', 'fit'][index]);
      $('#searchResults7').dataset.mapResults = '';
      $('#mapFullSearch7').innerHTML = '<div class="map-compact-head"><b class="map-compact-title">搜索结果</b><button type="button" class="map-compact-close" data-lj-map="exit-search" aria-label="退出地点搜索">×</button></div><div class="map-search-list7" data-map-results></div>';
      $('.side7 .close7').dataset.ljMap = 'full';
      // LJ-MAP-DETAIL-RESTORE-20261031: preserve approved reading positions; selecting a search name returns to these controls.
      $('.side7 .action7.primary').dataset.ljMap = 'read';
      $('.side7 .place-append7').dataset.ljMap = 'clear-route';
      $$('.side7 .route-set7 button').forEach((node, index) => node.dataset.ljMap = index ? 'destination' : 'origin');
      $('.side7 [data-current-map-locate]').dataset.ljMap = 'locate'; $('.side7 [data-current-map-locate]').title = '只定位当前地点';
      $('.place7h').dataset.mapTitle = ''; $('.lj-full-back').dataset.ljMap = 'normal';
      $('.side7 .sub7').classList.add('lj-place-summary', 'lj-selected-summary'); $('#mapCompact7').classList.add('lj-live-place-card');
      $$('.tools7 [title="进入全地图"]').forEach(node => node.dataset.ljMap = 'full');
      $('#ljMapRouteTools .lj-route-summary button').dataset.ljMap = 'clear-route';
      $('.depart7').dataset.ljMap = 'depart';
    } else {
      hosts.forEach(host => {
        host.innerHTML = searchMarkup();
        host.querySelector('[data-map-level-control]').dataset.expanded = String(host.id === 'fullMapCanvas');
        if (ui.layout === 'mobile') {
          host.querySelector('[data-map-history]').setAttribute('data-search-history', '');
          host.querySelector('.search').insertAdjacentHTML('beforeend', '<button type="button" class="mini-map-list-button" data-lj-map="history-menu">最近</button><button type="button" class="mini-map-list-button" data-lj-map="stash-menu">暂存</button>');
          host.querySelector('.search-float').insertAdjacentHTML('beforeend', '<div class="mini-map-menu" data-map-menu hidden></div>');
        }
      }); hosts[0].prepend(surface);
      $('#brandButton').dataset.ljMap = 'full'; $('#fullMapReturn').dataset.ljMap = 'normal';
      $('#fullMapReturn').removeAttribute('data-go');
      for (const selector of ['#mainPlaceName', '#dockPlaceName']) $(selector).dataset.mapTitle = '';
      for (const selector of ['#mainPlaceLocate', '#dockPlaceLocate']) $(selector).dataset.ljMap = 'locate';
      $('#mainPlaceDetail').dataset.ljMap = 'read'; $('#setOrigin').dataset.ljMap = 'origin'; $('#setDestination').dataset.ljMap = 'destination';
      const detail = $('#mainPlaceDetail'); detail.textContent = '详情'; detail.setAttribute('aria-label', '查看详情'); detail.title = '查看详情';
      $('#dockActions .origin').dataset.ljMap = 'origin'; $('#dockActions .dest').dataset.ljMap = 'destination';
      $('#dockActions [data-place-detail]').dataset.ljMap = 'read'; $('#dockActions [data-place-append]').dataset.ljMap = 'append';
      $('#dockToggle').dataset.ljMap = 'details';
      $('#mainPlaceIntro').classList.add('lj-place-summary', 'lj-selected-summary');
      $('#dockActions').insertAdjacentHTML('afterend', '<p class="v-full-detail lj-place-summary lj-selected-summary" data-map-dock-summary></p>');
      for (const selector of ['#routeClear', '#fullRouteClear']) $(selector).dataset.ljMap = 'clear-route';
      $$('.route-actions>.btn.primary,.full-route-line>.btn.primary').forEach(node => node.dataset.ljMap = 'depart');
    }
    $$('[data-travel],.travel-modes7 [data-mode]').forEach(node => { node.dataset.ljMap = 'travel'; node.dataset.mapTravel = MODE_IDS[node.dataset.travel || node.dataset.mode]; });
    $$('[data-map-query]').forEach(input => {
      input.addEventListener('compositionstart', () => { composingInput = input; invalidateSearch(); searchState.busy = true; renderSearch(); });
      input.addEventListener('compositionend', () => { composingInput = null; setQuery(input.value); });
      input.addEventListener('input', event => { if (composingInput !== input && !event.isComposing) setQuery(input.value); });
      input.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); composingInput = null; setQuery(''); }
        else if (event.key === 'Enter' && !composingInput && !event.isComposing && event.keyCode !== 229) { event.preventDefault(); local.query = input.value; invalidateSearch(); renderControls(); run(search); }
      });
    });
    $$('[data-map-region]').forEach(select => select.addEventListener('change', () => run(() => setRegion(select.value))));
  }
  async function ensureMap() {
    if (mounting) return mounting;
    mounting = (async () => {
      const savedView = state.mapView, savedMode = local.mode;
      map = createNationalMap(surface, { catalog, onSelect: entity => { if (!suppressSelection&&!state.placeEditor?.picker) run(() => choose(entity, Boolean(local.query.trim()))); }, onAppend: entity => {if(!state.placeEditor?.picker)ui.append(entity);}, onPickPosition:position=>{if(state.placeEditor?.picker){state.placeEditor.picker.candidate=position;renderPicker();}}, onError: error => ui.notify(error.message || String(error), 'error'), onViewChange: view => { state.mapView = view; local.regionCode = view.regionCode; local.mode = view.mode; } });
      map.setTheme(document.body.dataset.theme);
      await map.setPointVisibility(bridge.store.read().extensionUi?.mapPointVisibility);
      map.setHiddenPlaces(bridge.store.read().livingJapanSettings?.hiddenPlaceIds,ui.engine.data);
      await map.setRegion(savedView?.regionCode || local.regionCode);
      if (savedView) await map.setView(savedView);
      await map.setMode(savedView?.mode || savedMode); map.setRoute(state.routeOrigin, state.routeDestination);
      if (current()) { suppressSelection = true; try { await map.select(current(), { locate: false }); } finally { suppressSelection = false; } }
      const availability=catalog.availability?.(savedView?.regionCode || local.regionCode);
      if(availability?.available===false) { const note=document.createElement('aside'); note.className='lj-package-map-empty';note.innerHTML='<strong>此地区资料尚未载入</strong><p>载入地区资料后，可显示地图、搜索地点与阅读内置正文。</p><button class="lj-button primary">下载／载入地区资料</button>'; note.querySelector('button').onclick=()=>bridge.openPackages({focusId:availability.packageId||'metro',required:bridge.packages?.required});surface.append(note); }
    })().catch(error => { map?.destroy(); map = null; mounting = null; throw error; });
    return mounting;
  }
  async function transitService() {
    return transitPromise ||= loadTransitService({ baseline: bridge.baseline, baseData: ui.engine.data, baseUrl:bridge.baseUrl, fetcher:bridge.fetcher }).catch(error => { transitPromise = null; throw error; });
  }
  async function refreshRoute() {
    const key = `${state.routeOrigin?.id || ''}|${state.routeDestination?.id || ''}`;
    if (key === routeKey) return;
    routeKey = key; const epoch = ++routeEpoch; estimates = {}; selectedEndpoints = null;
    map?.setRoute(state.routeOrigin, state.routeDestination);
    if (!state.routeOrigin || !state.routeDestination) { routeStatus = '选择起点和终点后估算'; renderRoute(); return; }
    routeStatus = '正在读取参考耗时'; renderRoute();
    try {
      const service = await transitService();
      const result = service.estimateAll({ origin: state.routeOrigin, destination: state.routeDestination });
      if (dead || epoch !== routeEpoch) return;
      estimates = result.estimates; selectedEndpoints = { origin: result.origin, destination: result.destination }; routeStatus = ''; renderRoute();
    } catch (error) { if (epoch === routeEpoch) { routeKey = ''; routeStatus = error.message; renderRoute(); } }
  }
  function renderRoute() {
    const origin = state.routeOrigin, destination = state.routeDestination, selected = current(), mode = state.travelMode || 'public_transit', estimate = estimates[mode];
    const names = `${origin?.name || '未设起点'} → ${destination?.name || '未设终点'}`;
    const detail = routeStatus || (estimate?.ok ? `约 ${estimate.minutes} 分钟 · ${estimate.routeSummary || estimate.methodLabel}${estimate.accessReference ? ' · 含步行接驳粗估' : ''}` : '当前范围没有此方式的参考路线');
    map?.setRoute(origin, destination, estimate);
    const ready = Boolean(estimate?.ok && selectedEndpoints && (mode !== 'public_transit' || estimate.railPath?.lineSegments?.length));
    // LJ-MAP-DEPART-READY-20261031: reconnect the approved departure-button state colors.
    if (desktop) $('#work7').classList.toggle('route-ready', ready);
    if (desktop) { $('#ljRouteOrigin7').textContent = origin?.name || '未设起点'; $('#ljRouteDestination7').textContent = destination?.name || '未设终点'; $('#ljMapRouteTools').title = detail; }
    else { $('#routeLabel').textContent = names; $('#routeMeta').textContent = detail; $('[data-page-root="fullmap"] .route-status-line b').textContent = names; $('[data-page-root="fullmap"] .route-copy>span').textContent = detail; }
    $$('[data-lj-map="travel"]').forEach(node => {
      const id = node.dataset.mapTravel, value = estimates[id], name = TRAVEL.find(item => item[0] === id)?.[1] || id;
      node.classList.toggle('on', id === mode); node.classList.toggle('active', id === mode); node.setAttribute('aria-pressed', String(id === mode));
      const text = value?.ok ? `约${value.minutes}分` : origin && destination ? '暂无' : '—';
      node.innerHTML = desktop ? `<strong>${name}</strong><small>${text}</small>` : `${name} <small>${text}</small>`;
      node.title = value?.ok ? `${value.methodLabel}；${value.formula}` : origin && destination ? '当前参考资料未覆盖此路线' : '请先设起点和终点';
    });
    $$('[data-lj-map="depart"]').forEach(node => { node.disabled = !ready; node.title = detail; node.innerHTML = desktop ? '出发<small>追加交通参考</small>' : '出发'; });
    $$('[data-lj-map="origin"],[data-lj-map="destination"]').forEach(node => {
      const entity = node.dataset.mapEntity ? entities.get(node.dataset.mapEntity) || catalog.get(node.dataset.mapEntity) : selected, endpoint = node.dataset.ljMap === 'origin' ? origin : destination, role = node.dataset.ljMap === 'origin' ? '起点' : '终点';
      const active = entity?.id === endpoint?.id && Boolean(entity); node.disabled = administrative(entity); node.setAttribute('aria-pressed', String(active)); node.classList.toggle('v-endpoint-selected', active); node.classList.toggle('selected', active);
      node.textContent = node.closest('.map-search-actions7') ? role : `${active ? '取消' : endpoint ? '替换' : '设为'}${role}`;
      node.title = `${active ? '取消' : endpoint ? '替换' : '设置'}${role}${entity ? `：${entity.name}` : ''}`;
    });
  }
  const relatedSelection = createRelatedSelection(async entity => {
    const peers = await catalog.relatedDisplay(entity);
    await bridge.session.ensureSummaries?.([entity, ...peers]);
    return peers;
  }, () => { if (!dead) renderSelection(); }, error => ui.notify(error.message || String(error), 'error'));
  function renderSelection() {
    const entity = remember(current()); relatedSelection.select(entity, catalog.relatedDisplayRevision());
    const name = entity?.name || '请选择地点', meta = adminMarkup(entity), peers = relatedSelection.rows().map(remember), preview = summarize(entity, { selected: true });
    $$('[data-map-title]').forEach(node => { node.textContent = name; node.title = entity ? `${name} · 双击追加名称` : ''; });
    if (desktop) {
      $('.side7 .eyebrow7').innerHTML = meta; $('.side7 .eyebrow7').hidden = false; $('.side7 .sub7').textContent = preview.text; $('.side7 .sub7').hidden = !preview.text.trim(); $('.side7 .sub7').title = '';
      $('.related-title7 h4').textContent = `相关地点 ${peers.length} 个`;
      $('.related-list7').innerHTML = peers.map(item => `<li><button type="button" class="related-place7" data-lj-map="choose" ${attr(item)}><b>${esc(item.name)}</b><small class="lj-place-summary">${esc(summary(item))}</small></button><button type="button" class="append7" data-lj-map="append" ${attr(item)}>追加</button></li>`).join('');
      $('#mapCompact7').innerHTML = `<div class="map-compact-head"><div class="map-compact-title"><strong data-map-title title="${esc(name)} · 双击追加名称">${esc(name)}</strong></div>${locateButton(null, 'lj-search-pin')}<div class="lj-full-primary" aria-label="当前地点路线操作">${action('origin', '设为起点', null, 'data-map-endpoint="origin"')}${action('destination', '设为终点', null, 'data-map-endpoint="destination"')}</div><button type="button" class="lj-full-detail-toggle" data-lj-map="details" aria-expanded="${local.details}">${local.details ? '收起 ⌄' : '详情 ⌃'}</button></div><div class="lj-full-detail" ${local.details ? '' : 'hidden'}><div class="lj-full-path">${meta}</div><p class="lj-place-summary lj-selected-summary" ${preview.text.trim() ? '' : 'hidden'}>${esc(preview.text)}</p><div class="map-compact-actions">${action('append', '追加名称')}${action('read', '查看详情')}</div><div class="lj-full-related">${peers.map(item => `<button type="button" data-lj-map="choose" ${attr(item)}><span>${esc(item.name)}</span><small class="lj-place-summary">${esc(summary(item))}</small></button>`).join('')}</div></div>`;
    } else {
      $('#mainPlaceKind').innerHTML = meta; $('#mainPlaceKind').hidden = false; $('#dockPlaceMeta').innerHTML = meta; $('#dockPlaceMeta').hidden = false; $('#mainPlaceIntro').textContent = preview.text; $('#mainPlaceIntro').hidden = !preview.text.trim(); $('[data-map-dock-summary]').textContent = preview.text;
      $('#mapFeed .related-title b').textContent = `相关地点 ${peers.length} 个`;
      $('#mapRelated').innerHTML = peers.map(item => `<div class="li"><button type="button" class="grow related-peer-name" data-lj-map="choose" ${attr(item)}><span class="name">${esc(item.name)}</span><span class="meta lj-place-summary">${esc(summary(item))}</span></button><button type="button" class="btn text" data-lj-map="append" ${attr(item)}>追加</button></div>`).join('');
      $('#dockActions').hidden = false; $('[data-map-dock-summary]').hidden = !local.details || !preview.text.trim(); $('#dockToggle').textContent = local.details ? '收起详情' : '恢复详情'; $('#dockToggle').setAttribute('aria-expanded', String(local.details));
    }
    $$('[data-lj-map="read"],[data-lj-map="locate"],[data-lj-map="append"]').filter(node => !node.dataset.mapEntity).forEach(node => node.disabled = !entity);
    renderRoute(); splitter?.refresh();
  }
  function renderControls() {
    $$('[data-map-mode]').forEach(node => { const active = node.dataset.mapMode === local.mode; node.classList.toggle('on', active); node.setAttribute('aria-pressed', String(active)); node.title = MODE_HELP[node.dataset.mapMode]; });
    $$('[data-map-region]').forEach(node => { if (node.options.length !== catalog.regions().length) node.innerHTML = regionOptions(); node.value = local.regionCode; });
    $$('[data-map-favorites]').forEach(host => host.innerHTML = favorites().map((item, index) => `<button type="button" data-lj-map="favorite" data-map-favorite="${index}" title="${esc(item.name ? `${item.displayName} · ${item.name}；选择并定位` : `${item.displayName}：到设置选择地点`)}"><span>${esc(item.displayName)}</span></button>`).join(''));
    $$('[data-map-history]').forEach(host => { host.hidden = !local.history.length; host.dataset.covered = String(Boolean(local.query)); host.innerHTML = local.history.map(item => `<button type="button" data-lj-map="history" ${attr(item)}>${esc(item.name)}</button>`).join(''); });
    $$('[data-map-query]').forEach(input => { if (input !== composingInput && input.value !== local.query) input.value = local.query; });
    $$('[data-lj-map="exit-search"]').forEach(node => node.hidden = !local.query);
    $$('[data-map-menu]').forEach(host => {
      const active = local.menu && host.closest('.map').id === local.menuHost;
      host.hidden = !active; host.closest('.search-float').dataset.miniMenuOpen = String(Boolean(active));
      const rows = local.menu === 'stash' ? local.stash : local.history;
      host.innerHTML = active ? `<div class="mini-map-menu-head"><b>${local.menu === 'stash' ? '暂存地点' : '最近地点'}</b>${local.menu === 'stash' ? action('stash-add', '暂存当前地点') : ''}${action('menu-close', '×', null, 'aria-label="关闭地点列表"')}</div><div class="mini-map-menu-list">${rows.length ? rows.map(item => `<div class="mini-map-menu-row">${action('history', item.name, item)}${local.menu === 'stash' ? action('stash-remove', '×', item, `aria-label="移除暂存${esc(item.name)}"`) : ''}</div>`).join('') : '<p>暂无地点</p>'}</div>` : '';
      host.closest('.search-float').querySelectorAll('[data-lj-map$="-menu"]').forEach(node => node.setAttribute('aria-expanded', String(Boolean(active && node.dataset.ljMap.startsWith(local.menu)))));
    });
  }
  function renderSearchResult({ entity, name, metaText }, index) {
    const nameClass = desktop ? 'map-search-name7' : 'search-result-name', metaTag = desktop ? 'small' : 'span';
    const content = `<button type="button" class="${nameClass}" data-lj-map="search-choose" ${attr(entity)}><i class="lj-search-number" aria-hidden="true">${index + 1}</i><span class="lj-search-copy"><b>${esc(name)}</b><${metaTag} class="lj-place-summary">${esc(metaText)}</${metaTag}></span></button>`;
    const pinDisabled = entity.type !== '行政区' && !map?.hasAnchor(entity);
    return desktop
      ? `<div class="map-search-row7" data-map-search-row="${esc(entity.id)}">${content}<div class="result-actions7 map-search-actions7 lj-result-actions">${action('origin', '起点', entity)}${action('destination', '终点', entity)}${action('append', '追加', entity)}${locateButton(entity, 'lj-search-pin current-map-locate7', pinDisabled)}</div></div>`
      : `<div class="search-result" data-map-search-row="${esc(entity.id)}">${content}${locateButton(entity, 'search-locate', pinDisabled)}</div>`;
  }
  // LJ-MAP-COMPLETE-SEARCH-20261101: one query session owns all layouts, cached pages and the temporary page markers.
  function invalidateSearch() {
    if (timer !== null) clearTimeout(timer); timer = null; ++searchEpoch; ++searchPageRequest;
    Promise.resolve(catalog.cancelSearch?.('map-search')).catch(error => { if (!dead) ui.notify(error.message, 'error'); });
    searchState = { query: '', queryId: null, result: null, progress: null, busy: false, paging: false, counts: {} };
    map?.setSearchResults([]);
  }
  // LJ-MAP-SEARCH-REGION-SUMMARY-20261101: all search shells share the same live prefecture counts and catalog labels.
  function searchRegionSummary(found, regionCounts) {
    const labels = new Map(catalog.regions().map(region => [String(region.code), region.name || region.label || region.nameJa || String(region.code)]));
    const regions = Object.entries(regionCounts).filter(([, count]) => count > 0).sort(([left], [right]) => left.localeCompare(right));
    return [`已搜索到${found}`, ...regions.map(([code, count]) => `${code === '00' ? '其他' : (labels.get(code) || code).replace(/[都府县県]$/, '')}${count}`)].join(' · ');
  }
  function renderSearchRows(host, list, items, page, empty) {
    const key = `${searchEpoch}:${page}`;
    let rendered = renderedSearchRows.get(host);
    if (!rendered || rendered.key !== key) {
      list.innerHTML = ''; rendered = { key, rows: new Map(), empty: '' }; renderedSearchRows.set(host, rendered);
    }
    if (!items.length) {
      if (!rendered.rows.size && rendered.empty !== empty) { list.innerHTML = `<div class="search-empty">${empty}</div>`; rendered.empty = empty; }
      return;
    }
    if (!rendered.rows.size) list.innerHTML = '';
    rendered.empty = '';
    items.forEach((item, index) => {
      let row = rendered.rows.get(item.id);
      if (!row) {
        list.insertAdjacentHTML('beforeend', renderSearchResult(item, index));
        row = list.lastElementChild; rendered.rows.set(item.id, row);
      }
      const name = row.querySelector('b'), meta = row.querySelector('.lj-place-summary'), number = row.querySelector('.lj-search-number');
      if (name.textContent !== item.name) name.textContent = item.name;
      if (meta.textContent !== item.metaText) meta.textContent = item.metaText;
      if (number.textContent !== String(index + 1)) number.textContent = String(index + 1);
      const pin = row.querySelector('[data-lj-map="locate"]');
      pin.disabled = item.entity.type !== '行政区' && !map?.hasAnchor(item.entity); pin.setAttribute('aria-label', `只定位${item.name}`);
    });
  }
  function renderSearch() {
    const result = searchState.result, progress = searchState.progress || {}, active = Boolean(local.query.trim()), complete = result?.complete === true;
    const found = complete ? result.total : progress.matched ?? result?.matchedSoFar ?? 0;
    const regionCounts = progress.regionCounts ?? result?.regionCounts ?? {}, summaryText = searchRegionSummary(found, regionCounts), sameQuery = renderedQuery === local.query;
    const located = progress.located ?? result?.located ?? 0, near = progress.near ?? result?.near ?? 0;
    const outside = progress.outside ?? result?.outside ?? Math.max(0, located - near), page = result?.page || 0, pages = result?.pages;
    const items = result?.items || [], models = items.map(item => createSearchResultItem(item.entity || item));
    const busy = searchState.busy || searchState.paging;
    const empty = complete ? '没有匹配的名称或类型' : searchState.error ? '搜索未完成，请重试' : '正在搜索…';
    const markup = `<div class="lj-search-status" role="status"><span class="lj-search-summary"></span><i class="lj-search-busy" aria-label="正在搜索"></i></div><div class="lj-search-list" data-map-search-list></div><div class="lj-search-pages"><button type="button" data-lj-map="search-prev">上一页</button><span class="lj-search-page-position"><input type="number" min="1" inputmode="numeric" aria-label="搜索结果页码" data-map-search-page><span></span></span><button type="button" data-lj-map="search-next">下一页</button><button type="button" data-lj-map="search-fit">总览本页</button></div>`;
    const audit = { query: searchState.query || local.query.trim(), queryId: searchState.queryId, total: complete ? result.total : null, matchedSoFar: found, located, unlocated: progress.unlocated ?? result?.unlocated ?? null, boundaryCount: progress.boundaryCount ?? result?.boundaryCount ?? 0, near, outside, page, pages: pages ?? null, pageSize: result?.pageSize || 40, complete, busy, scope: result?.region || searchState.regionCode || local.regionCode,
      priorityBounds: result?.priorityBounds ?? searchState.priorityBounds ?? null, regionCounts, sourceCounts: progress.sourceCounts ?? result?.sourceCounts ?? {}, reusedCache: Boolean(result?.reusedCache), scanned: progress.scanned ?? result?.scanned ?? 0, scanMs: result?.scanMs ?? null, priorityMs: result?.priorityMs ?? null,
      phase: progress.phase ?? result?.phase ?? null, requestVersion: result?.requestVersion ?? searchState.requestVersion ?? null, firstResultMs: progress.firstResultMs ?? result?.firstResultMs ?? null, counts: searchState.counts };
    $$('[data-map-results]').forEach(host => {
      const previous = host.querySelector('[data-map-search-list]'), top = renderedQuery === local.query ? previous?.scrollTop || 0 : 0;
      const summaryLeft = sameQuery ? host.querySelector('.lj-search-summary')?.scrollLeft || 0 : 0;
      host.classList.add('lj-map-search-results'); host.hidden = !active;
      host.setAttribute('aria-busy', String(busy)); host.dataset.searchAudit = JSON.stringify(audit);
      if (!active) { host.innerHTML = ''; renderedSearchRows.delete(host); return; }
      if (!previous) host.innerHTML = markup;
      const list = host.querySelector('[data-map-search-list]'); renderSearchRows(host, list, models, page, empty); list.scrollTop = top;
      const status = host.querySelector('.lj-search-status'); status.hidden = desktop && host.id === 'searchResults7';
      const summary = status.querySelector('.lj-search-summary'); summary.textContent = summaryText; summary.scrollLeft = summaryLeft;
      host.querySelector('.lj-search-busy').hidden = !busy;
      const pageInput = host.querySelector('[data-map-search-page]');
      pageInput.disabled = !complete || searchState.paging; pageInput.max = String(pages || 1);
      if (!searchState.paging && document.activeElement !== pageInput) pageInput.value = String(page + 1);
      host.querySelector('.lj-search-page-position>span').textContent = ` / ${pages || '…'}`;
      host.querySelector('[data-lj-map="search-prev"]').disabled = !complete || page === 0 || searchState.paging;
      host.querySelector('[data-lj-map="search-next"]').disabled = !complete || page >= pages - 1 || searchState.paging;
      host.querySelector('[data-lj-map="search-fit"]').disabled = !items.length;
    });
    renderedQuery = local.query;
    if (desktop) {
      $('#work7').classList.toggle('searching', active); $('#work7').classList.toggle('searching7', active);
      $('.side7 .search-view7').style.display = active ? 'flex' : 'none'; $('.side7 .detail7').hidden = active;
      const count = $('#searchCount7');
      if (!count.querySelector('.lj-search-summary')) count.innerHTML = '<span class="lj-search-summary"></span><i class="lj-search-busy" aria-label="正在搜索"></i>';
      const summary = count.querySelector('.lj-search-summary'), summaryLeft = sameQuery ? summary.scrollLeft : 0;
      summary.textContent = summaryText; summary.scrollLeft = summaryLeft; count.querySelector('.lj-search-busy').hidden = !busy;
      $('#mapFullSearch7').hidden = !local.full || !active;
    }
  }
  function acceptSearchResult(result, counts = {}) {
    searchState.queryId = result.queryId; searchState.result = result; searchState.progress = null;
    searchState.busy = !result.complete; searchState.paging = false; searchState.error = false; searchState.counts = counts;
    const entities = (result.items || []).map(item => remember(item.entity || item));
    map?.setSearchResults(entities); renderSearch(); renderRoute();
  }
  async function search() {
    if (timer !== null) clearTimeout(timer); timer = null;
    const epoch = searchEpoch, query = local.query.trim();
    if (!query || composingInput || dead) { renderSearch(); return; }
    searchState.query = query; searchState.busy = true; searchState.error = false; renderSearch(); await ensureMap();
    if (epoch !== searchEpoch || dead) return;
    searchState.regionCode = local.regionCode; searchState.priorityBounds = map.getSearchBounds();
    const started = await catalog.startMapSearch(query, { regionCode: searchState.regionCode, priorityBounds: searchState.priorityBounds, requestScope: 'map-search', pageSize: 40,
      onUpdate(event) {
        if (epoch !== searchEpoch || dead || searchState.queryId && searchState.queryId !== event.queryId) return;
        searchState.queryId = event.queryId; searchState.requestVersion = event.requestVersion; searchState.counts = event.counts || {};
        if (event.type === 'first' || event.type === 'complete') acceptSearchResult(event.result, event.counts);
        else if (event.type === 'progress') { searchState.progress = event.result; renderSearch(); }
        else if (event.type === 'error' || event.type === 'aborted') { searchState.busy = false; searchState.error = true; renderSearch(); if (event.type === 'error') ui.notify(event.result.message, 'error'); }
      },
    }).catch(error => { if (epoch === searchEpoch && !dead) { searchState.busy = false; searchState.error = true; renderSearch(); } throw error; });
    if (epoch === searchEpoch && !dead && !started.cancelled) { searchState.queryId = started.queryId; searchState.requestVersion = started.requestVersion; }
  }
  async function searchPage(change, absolute = false) {
    const result = searchState.result; if (!result?.complete || searchState.paging) return;
    const nextPage = Math.max(0, Math.min(result.pages - 1, absolute ? Math.trunc(Number(change) || 1) - 1 : result.page + change));
    if (absolute) $$('[data-map-search-page]').forEach(input => input.value = String(nextPage + 1));
    if (nextPage === result.page) { renderSearch(); return; }
    const epoch = searchEpoch, queryId = searchState.queryId, ticket = ++searchPageRequest;
    searchState.paging = true; renderSearch();
    try {
      const next = await catalog.mapSearchPage(queryId, { page: nextPage, pageSize: 40 });
      if (epoch !== searchEpoch || ticket !== searchPageRequest || queryId !== searchState.queryId || dead) return;
      renderedQuery = ''; acceptSearchResult(next, next.counts || searchState.counts);
    } catch (error) { if (epoch === searchEpoch && !dead) { searchState.paging = false; renderSearch(); throw error; } }
  }
  function setQuery(value) {
    if (local.query === value && timer !== null) return;
    local.query = value; local.menu = ''; invalidateSearch(); searchState.busy = Boolean(value.trim()); renderControls(); renderSearch();
    if (value.trim()) timer = setTimeout(() => { timer = null; run(search); }, 400);
  }
  async function setRegion(code) {
    const availability=catalog.availability?.(code); if(availability?.available===false) { await bridge.openPackages({focusId:availability.packageId}); renderControls(); return; }
    invalidateSearch(); const epoch = searchEpoch; searchState.busy = Boolean(local.query.trim()); renderSearch();
    if(!map) { local.regionCode=code;mounting=null; }
    await ensureMap(); await map.setRegion(code); if (epoch !== searchEpoch || dead) return;
    state.regionCode = String(code); state.mapView = map.getView(); renderControls(); if (local.query.trim()) await search();
  }
  async function choose(entity, clear = false) {
    if (!entity || !(await ui.reader.close())) return false;
    if (clear) setQuery('');
    remember(entity); local.history = [entity, ...local.history.filter(item => item.id !== entity.id)].slice(0, 4); local.menu = '';
    await ui.selectEntity(entity, { locate: false });
    renderControls(); return true;
  }
  async function select(entity, options = {}) {
    remember(entity); renderSelection(); await ensureMap();
    suppressSelection = true;
    try { await map.select(entity, { locate: options.locate === true }); } finally { suppressSelection = false; }
    state.mapView = map.getView(); if (options.locate === true) state.regionCode = state.mapView.regionCode; local.mode = state.mapView.mode; renderControls();
  }
  async function locate(entity) {
    if (!entity) return; await ensureMap();
    if (!map.hasAnchor(entity) && entity.type !== '行政区') { ui.notify('此地点暂无可定位坐标'); return; }
    await map.locate(entity); state.regionCode = map.getView().regionCode; state.mapView = map.getView(); local.mode = state.mapView.mode; renderControls();
  }
  async function endpoint(kind, entity) {
    if (administrative(entity)) return;
    const service = await transitService();
    if (!service.resolveEndpoint(entity)) { ui.notify('此地点暂无可用的交通地理锚点'); return; }
    const next = nextEndpoints(state.routeOrigin, state.routeDestination, kind, entity); state.routeOrigin = next.origin; state.routeDestination = next.destination;
    renderRoute(); await refreshRoute();
  }
  async function setFullMap(value) {
    if (!(await ui.reader.close())) return;
    if (state.page !== 'map') { await ui.showPage('map'); if (state.page !== 'map') return; }
    local.full = Boolean(value); applyFullMap(); await ensureMap();
  }
  async function beginPositionPick(position){
    const draft=state.placeEditor;if(!draft)return;
    await ensureMap();
    draft.picker={view:map.getView(),full:local.full,returnPage:state.page,candidate:position?{...position}:null,original:position?{...position}:null};
    if(!(await ui.showPage('map'))){delete draft.picker;ui.placeEditor.render();return;}
    local.full=true;await map.setMode(local.mode==='schem'?'detail':local.mode);map.setPositionPick(true,draft.picker.candidate);applyFullMap();renderPicker();
  }
  async function finishPositionPick(confirm){
    const draft=state.placeEditor,picker=draft?.picker;if(!picker)return;
    if(confirm&&!picker.candidate)return;
    if(confirm)draft.values.coordinates={...picker.candidate};
    map.setPositionPick(false);delete draft.picker;surface.querySelector('[data-position-picker]')?.remove();
    document.body.classList.remove('lj-position-picking');
    local.full=picker.full;await map.setView(picker.view);state.mapView=map.getView();applyFullMap();await ui.showPage(picker.returnPage||'region');ui.placeEditor.render();
  }
  function renderPicker(){
    surface.querySelector('[data-position-picker]')?.remove();const picker=state.placeEditor?.picker;if(!picker)return;
    document.body.classList.add('lj-position-picking');
    const toolbar=document.createElement('div');toolbar.className='lj-position-picker';toolbar.dataset.positionPicker='';
    toolbar.innerHTML=`<span role="status">${picker.candidate?`临时位置 ${picker.candidate.longitude.toFixed(6)}，${picker.candidate.latitude.toFixed(6)}`:'点击地图选择位置，可拖动或缩放'}</span><button type="button" data-lj-map="pick-cancel">取消选点</button><button type="button" data-lj-map="pick-confirm" ${picker.candidate?'':'disabled'}>确认位置</button>`;surface.append(toolbar);
  }
  function applyFullMap() {
    if (desktop) { $('#work7').classList.toggle('side-off', local.full); $('#ljFullMapPanels').hidden = !local.full; $('#mapFullSearch7').hidden = !local.full || !local.query; }
    else { $('[data-page-root="map"]').hidden = local.full; $('[data-page-root="fullmap"]').hidden = !local.full; (local.full ? hosts[1] : hosts[0]).prepend(surface); $('#device').classList.toggle('fullmap', local.full); }
    renderBrandControl();
  }
  // LJ-MAP-BRAND-20261102: the narrow brand reflects the visible map state across page changes.
  function renderBrandControl() {
    if (desktop) return;
    const full = state.page === 'map' && local.full, brand = $('#brandButton');
    brand.innerHTML = full ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20C9 15 9 8 12 3c3 5 3 12 0 17Z"/><path d="M11 20C6 18 3 14 4 8c5 1 8 5 7 12Z"/><path d="M13 20c5-2 8-6 7-12-5 1-8 5-7 12Z"/><path d="M12 20v2"/></svg>' : '<span class="lj-map-expand" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg><span>大</span></span>';
    brand.dataset.icon = full ? 'lily' : 'expand';
    brand.disabled = Boolean(full);
    brand.title = full ? 'Living Japan · 全地图' : '进入无边全地图';
    brand.setAttribute('aria-label', brand.title);
  }
  async function depart() {
    const mode = state.travelMode || 'public_transit', estimate = estimates[mode];
    if (!estimate?.ok || !selectedEndpoints) return;
    const service = await transitService(), endpoints = injectionEndpoints(selectedEndpoints, { origin: state.routeOrigin, destination: state.routeDestination }, ui.engine.data);
    const comment = service.format({ ...endpoints, mode, estimate });
    if (!comment) { ui.notify('当前路线缺少可用的交通说明'); return; }
    const result = await bridge.appendTraffic(comment); ui.notify(result === false || result?.ok === false ? result?.error || '没有找到聊天输入框' : result?.warning || '交通参考已追加到输入框', result?.ok === false ? 'error' : undefined);
  }
  async function click(event) {
    const node = event.target.closest('[data-lj-map]'); if (!node) return;
    const cmd = node.dataset.ljMap, entity = node.dataset.mapEntity ? local.history.find(item => item.id === node.dataset.mapEntity) || local.stash.find(item => item.id === node.dataset.mapEntity) || await resolve(node.dataset.mapEntity) : current();
    if(cmd==='pick-confirm'||cmd==='pick-cancel'){await finishPositionPick(cmd==='pick-confirm');return;}
    if(state.placeEditor?.picker){if(['read','append','origin','destination','depart','clear-route'].includes(cmd))return;if(['full','normal'].includes(cmd)){await finishPositionPick(false);return;}if(cmd==='mode'&&node.dataset.mapMode==='schem')return;if(['choose','history','search-choose'].includes(cmd)){await locate(entity);return;}}
    if (cmd === 'choose' || cmd === 'history' || cmd === 'search-choose') await choose(entity, cmd === 'search-choose');
    else if (cmd === 'locate') await locate(entity);
    else if (cmd === 'append') ui.append(entity);
    else if (cmd === 'read') await ui.openReader(entity);
    else if (cmd === 'origin' || cmd === 'destination') await endpoint(cmd, entity);
    else if (cmd === 'clear-route') { state.routeOrigin = state.routeDestination = null; await refreshRoute(); }
    else if (cmd === 'mode') { const control = node.closest('[data-map-level-control]'); if (control?.dataset.expanded === 'false' && node.dataset.mapMode === local.mode) { control.dataset.expanded = 'true'; return; } local.mode = node.dataset.mapMode; await ensureMap(); await map.setMode(local.mode); if (control && !local.full) control.dataset.expanded = 'false'; renderControls(); state.mapView = map.getView(); }
    else if (cmd === 'travel') { state.travelMode = node.dataset.mapTravel; renderRoute(); }
    else if (cmd === 'depart') await depart();
    else if (cmd === 'full' || cmd === 'normal') await setFullMap(cmd === 'full' ? !(local.full && (desktop || state.page === 'map')) : false);
    else if (cmd === 'details') { local.details = !local.details; renderSelection(); }
    else if (cmd === 'history-menu' || cmd === 'stash-menu') { const kind = cmd.split('-')[0], host = node.closest('.map').id; local.menu = local.menu === kind && local.menuHost === host ? '' : kind; local.menuHost = host; renderControls(); }
    else if (cmd === 'menu-close') { local.menu = ''; renderControls(); }
    else if (cmd === 'stash-add') { if (entity && !local.stash.some(item => item.id === entity.id)) local.stash.push(entity); renderControls(); }
    else if (cmd === 'stash-remove') { local.stash = local.stash.filter(item => item.id !== entity?.id); renderControls(); }
    else if (cmd === 'exit-search') setQuery('');
    else if (cmd === 'search-prev' || cmd === 'search-next') await searchPage(cmd === 'search-prev' ? -1 : 1);
    else if (cmd === 'search-fit') { await ensureMap(); await map.fitSearchResults(); state.mapView = map.getView(); }
    else if (cmd === 'zoom-in' || cmd === 'zoom-out' || cmd === 'fit') { await ensureMap(); if (cmd === 'fit') map.fit(); else map.zoom(cmd === 'zoom-in' ? 1 : -1); state.mapView = map.getView(); }
    else if (cmd === 'favorite') {
      const favorite = favorites()[Number(node.dataset.mapFavorite)], target = favorite.entityId && (entities.get(favorite.entityId) || catalog.get(favorite.entityId) || await catalog.resolve(favorite.entityId, { regionCode: favorite.regionCode || local.regionCode }));
      if (!target) { await ui.openSettings('favorites'); return; }
      if (!(await choose(target))) return; await locate(target);
    }
  }
  const handleClick = event => run(() => click(event));
  const doubleClick = event => { if (event.target.closest('[data-map-title]') && current()) ui.append(current()); };
  const pageChange = event => { if (event.target.matches('[data-map-search-page]')) run(() => searchPage(event.target.value, true)); };
  const pageKeyDown = event => { if (event.key === 'Enter' && event.target.matches('[data-map-search-page]')) { event.preventDefault(); run(() => searchPage(event.target.value, true)); } };
  prepare();
  if (!desktop) splitter = mountMapSplitter({ page: $('[data-page-root="map"]'), map: $('#mapCanvas'), feed: $('#mapFeed'), related: $('#mapRelated'), route: $('[data-page-root="map"]>.routebar'), state: local.splitHeights ||= {}, layout: ui.layout });
  document.addEventListener('click', handleClick); document.addEventListener('dblclick', doubleClick);
  document.addEventListener('change', pageChange); document.addEventListener('keydown', pageKeyDown);
  async function render() {
    renderControls(); renderSelection(); applyFullMap(); await ensureMap(); map.setTheme(document.body.dataset.theme); await map.setPointVisibility(bridge.store.read().extensionUi?.mapPointVisibility);
    map.setHiddenPlaces(bridge.store.read().livingJapanSettings?.hiddenPlaceIds,ui.engine.data);
    if(state.placeEditor?.picker){local.full=true;if(local.mode==='schem')await map.setMode('detail');map.setPositionPick(true,state.placeEditor.picker.candidate);applyFullMap();renderPicker();}
    else{map.setPositionPick(false);surface.querySelector('[data-position-picker]')?.remove();document.body.classList.remove('lj-position-picking');}
    if (local.query.trim() && searchState.query !== local.query.trim() && timer === null && !composingInput) await search(); else renderSearch();
    await refreshRoute();
  }
  return { render, select, locate, setRegion, setFullMap, renderBrandControl, beginPositionPick, destroy() { dead = true; invalidateSearch(); composingInput = null; splitter?.destroy(); relatedSelection.destroy(); ++routeEpoch; if (map) state.mapView = map.getView(); map?.destroy(); document.removeEventListener('click', handleClick); document.removeEventListener('dblclick', doubleClick); document.removeEventListener('change', pageChange); document.removeEventListener('keydown', pageKeyDown); } };
}
