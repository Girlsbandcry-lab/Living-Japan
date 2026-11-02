import test from 'node:test';
import assert from 'node:assert/strict';
import { mountMap } from '../ui/map.js';
import { mountBrowser } from '../ui/browse.js';
import { esc } from '../ui/dom.js';
import { createUserStore } from '../src/storage.js';

// A DOM boundary fixture: run the live rendering and event handlers without a canvas or browser.
function documentFixture() {
  const nodes = new Map(), listeners = new Map();
  let document;
  function node(key = '') {
    if (nodes.has(key)) return nodes.get(key);
    const events = new Map(), captured = new Set(), value = {
      id: key.startsWith('#') ? key.slice(1) : '', dataset: {}, style: {}, hidden: false,
      innerHTML: '', textContent: '', value: '', checked: false, scrollTop: 0, clientHeight: 0,
      children: [], classList: { add() {}, remove() {}, toggle() {} },
      setAttribute(name, value) { this[name] = value; }, removeAttribute(name) { delete this[name]; },
      addEventListener(name, fn) { events.set(name, fn); }, removeEventListener() {},
      focus() {}, setPointerCapture(id) { captured.add(id); }, hasPointerCapture(id) { return captured.has(id); }, releasePointerCapture(id) { captured.delete(id); },
      fire(name, extra = {}) { events.get(name)?.({ pointerId: 1, button: 0, isPrimary: true, clientY: 0, preventDefault() {}, stopPropagation() {}, ...extra }); },
      querySelector(selector) { return node(selector); }, querySelectorAll() { return []; },
      closest(selector) { return selector === '.region-list-scroll' ? node('region-scroll') : null; },
      insertAdjacentHTML(position, html) { if (position === 'afterend') node('inline-detail').innerHTML = html; else this.innerHTML += html; },
      getBoundingClientRect() { return { height: 0, width: 0, top: 0, bottom: 0 }; },
      prepend() {}, appendChild(child) { if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(item => item !== child); child.parentElement = this; this.children.push(child); return child; }, remove() {},
      async click(dataset) { await events.get('click')?.({ target: { closest: () => ({ dataset }) } }); },
      get ownerDocument() { return document; },
    };
    nodes.set(key, value); return value;
  }
  document = {
    querySelector: node, querySelectorAll: selector => selector === '#regionCrumb,#regionDrawerCrumb' ? [node('#regionCrumb'),node('#regionDrawerCrumb')] : [], body: node('body'),
    createElement(tag) { if (tag === 'canvas') throw new Error('Canvas omitted by DOM fixture'); return node(`created:${nodes.size}`); },
    addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener() {},
    defaultView: { addEventListener() {}, removeEventListener() {} },
    async click(dataset) { listeners.get('click')?.({ target: { closest: selector => selector === '[data-lj-map]' ? { dataset } : null } }); await settle(); },
  };
  return { document, node };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
function fixture(layout = 'desktop') {
  const dom = documentFixture(), previousDocument = globalThis.document, previousCSS = globalThis.CSS;
  globalThis.document = dom.document; globalThis.CSS = { escape: value => value };
  if (layout === 'desktop') dom.node('.side7 .create7').appendChild(dom.node('.side7 .action7.primary'));
  const pref = { id: 'pref:13', name: '东京都', type: '行政区', summary: '都内各区及多摩地区。', adminNodes: [] };
  const ward = { id: 'ward:港', name: '港区', type: '行政区', summary: '临海地区与内陆高地。', adminNodes: [pref] };
  const place = { id: 'place:new', name: '新收录公园', type: '公园', summary: '草地环绕池塘。', adminNodes: [pref, ward], packageIds: [], coordinates: { longitude: 139, latitude: 35 } };
  const peer = { ...place, id: 'place:peer', name: '邻近展馆', type: '展馆', summary: '沿街的展厅。' };
  const entities = new Map([pref, ward, place, peer].map(value => [value.id, value]));
  const selected = [], opened = [], pending = new Map(), errors = [];
  const catalog = {
    navigationRoot: 'root', regions: () => [], get: id => entities.get(id), resolve: async id => entities.get(id),
    normalizeBrowseState: async saved => ({ ...saved, pathIds: saved.pathIds || [] }), browseNode: async id => entities.get(id),
    relatedDisplay: entity => new Promise(resolve => pending.set(entity.id, resolve)), relatedDisplayRevision: () => 0, navigationPath: async id => id === 'root' ? [] : [pref, ward, entities.get(id)].filter((e, i, all) => e && all.findIndex(n => n?.id === e.id) === i),
    browsePage: async () => ({ items: [place, peer], total: 2, offset: 0, hasMore: false }),
    browseLocation: async entity => ({ status: 'found', parentId: 'root', offset: 0, pathIds: [], entryId: entity.id }), browseEntryId: entity => entity.id,
  };
  const engine = { data: { packages: [] }, normalizeTextOverrides: value => structuredClone({ records: {}, orphans: {}, ...value }), resolveEffectiveBody: item => ({ body: item.body || '' }) };
  const ui = {
    layout, esc, state: { selected: place, selectedId: place.id, page: 'region', regionCode: '13' }, engine,
    // LJ-READER-FIXTURE-20261031: the live bridge supplies the async summary-loading session.
    bridge: { catalog, session: { ensureSummaries: async () => {} }, store: { read: () => ({ livingJapanTextOverrides: { records: {} } }) } },
    reader: { close: async () => true, packageIds: entity => entity.packageIds || [] },
    notify: error => errors.push(error), selectEntity: async (entity, options) => { selected.push({ entity, options }); ui.state.selected = entity; },
    openReader: async entity => opened.push(entity),
  };
  return { ...dom, ui, place, peer, pref, ward, pending, selected, opened, errors,
    restore() { globalThis.document = previousDocument; globalThis.CSS = previousCSS; } };
}

test('every map layout keeps actionable administration without a body and chooses the parent without locating', async () => {
  for (const layout of ['desktop', 'portrait', 'mobile']) {
    const f = fixture(layout); let map;
    try {
      map = mountMap(f.ui);
      await assert.rejects(map.select(f.place), /Canvas omitted/);
      const paths = layout === 'desktop' ? [f.node('.side7 .eyebrow7'), f.node('#mapCompact7')] : [f.node('#mainPlaceKind'), f.node('#dockPlaceMeta')];
      for (const path of paths) {
        assert.equal(path.hidden, false);
        assert.match(path.innerHTML, /data-map-entity="pref:13"[^>]*>东京都/);
        assert.match(path.innerHTML, /data-map-entity="ward:港"[^>]*>港区/);
      }
      await f.document.click({ ljMap: 'choose', mapEntity: f.ward.id });
      assert.equal(f.selected.at(-1).entity, f.ward);
      assert.deepEqual(f.selected.at(-1).options, { locate: false });
      await assert.rejects(map.select(f.ward), /Canvas omitted/);
      assert.equal(f.node(layout === 'desktop' ? '.side7 .sub7' : '#mainPlaceIntro').textContent, '临海地区与内陆高地。');
      f.ui.reader.close = async () => false;
      await f.document.click({ ljMap: 'choose', mapEntity: f.pref.id });
      assert.equal(f.selected.length, 1, 'a refused reader leave must not switch the current place');
    } finally { map?.destroy(); f.restore(); }
  }
});

test('map split preferences survive a fresh store and layout changes, while failed saves retain the current session height', async () => {
  let remote = { livingJapanUIPreferences: { panelPinned: true, mapSplitHeights: { portrait: 360, mobile: 220 } } }, writes = 0, fail = false;
  const transport = { read: async () => structuredClone(remote), write: async value => { if (fail) throw new Error('测试保存失败'); remote = structuredClone(value); writes++; } };
  const store = createUserStore({ transport }); await store.load();
  function open(layout, currentStore, mapUi) {
    const f = fixture(layout); f.ui.bridge.store = currentStore;
    if (mapUi) f.ui.state.mapUi = mapUi;
    const page = f.node('[data-page-root="map"]'), mapNode = f.node('#mapCanvas'), feed = f.node('#mapFeed'), related = f.node('#mapRelated');
    const height = () => parseFloat(page.style.gridTemplateRows) || 319;
    page.clientHeight = 812; page.getBoundingClientRect = () => ({ height: 812 });
    mapNode.getBoundingClientRect = () => ({ height: height() });
    feed.getBoundingClientRect = () => ({ top: height() });
    related.getBoundingClientRect = () => ({ bottom: height() + 264 });
    f.node('[data-page-root="map"]>.routebar').getBoundingClientRect = () => ({ height: 94 });
    let map = mountMap(f.ui);
    return { ...f, height, handle: () => page.children.at(-1), remount() { map.destroy(); map = mountMap(f.ui); }, close() { map.destroy(); f.restore(); } };
  }
  let f = open('portrait', store), session;
  try {
    assert.equal(f.height(), 360);
    f.handle().fire('pointerdown', { clientY: 360 });
    f.handle().fire('pointermove', { clientY: 380 }); f.handle().fire('pointermove', { clientY: 400 });
    await settle(); assert.equal(writes, 0);
    f.handle().fire('pointerup');
    assert.equal(store.read().livingJapanUIPreferences.mapSplitHeights.portrait, 360, 'the queued save has not completed yet');
    f.remount(); assert.equal(f.height(), 400, 'remount during a pending save keeps the just-adjusted session height');
    await settle();
    assert.equal(writes, 1); assert.deepEqual(remote.livingJapanUIPreferences.mapSplitHeights, { portrait: 400, mobile: 220 });
    session = f.ui.state.mapUi;
  } finally { f.close(); }
  f = open('mobile', store, session);
  try {
    assert.equal(f.height(), 220); f.handle().fire('keydown', { key: 'ArrowDown' }); await settle();
    assert.deepEqual(remote.livingJapanUIPreferences.mapSplitHeights, { portrait: 400, mobile: 244 });
    assert.equal(remote.livingJapanUIPreferences.panelPinned, true);
  } finally { f.close(); }
  f = open('desktop', store, session); f.close();
  f = open('portrait', store, session);
  try { assert.equal(f.height(), 400); } finally { f.close(); }
  const reloaded = createUserStore({ transport }); await reloaded.load();
  f = open('portrait', reloaded);
  try {
    assert.equal(f.height(), 400, 'fresh app state restores the persisted height');
    fail = true; f.handle().fire('keydown', { key: 'ArrowDown' }); await settle();
    assert.equal(f.height(), 424); assert.deepEqual(f.errors, ['测试保存失败']);
    assert.equal(remote.livingJapanUIPreferences.mapSplitHeights.portrait, 400);
    f.remount(); assert.equal(f.height(), 424, 'remount must prefer the current session over a stale persisted value');
  } finally { f.close(); }
});

test('each selected map heading keeps type above a standalone introduction and hides an empty introduction', async () => {
  for (const layout of ['desktop', 'portrait', 'mobile']) {
    const f = fixture(layout); let map;
    try {
      map = mountMap(f.ui);
      await assert.rejects(map.select(f.place), /Canvas omitted/);
      const intro = f.node(layout === 'desktop' ? '.side7 .sub7' : '#mainPlaceIntro');
      assert.equal(intro.textContent, '草地环绕池塘。');
      assert.equal(intro.hidden, false);
      const meta = f.node(layout === 'desktop' ? '.side7 .eyebrow7' : '#mainPlaceKind');
      assert.match(meta.innerHTML, /公园/);
      f.pending.get(f.place.id)([f.peer]); await settle();
      const related = f.node(layout === 'desktop' ? '.related-list7' : '#mapRelated');
      assert.match(related.innerHTML, /展馆 · 沿街的展厅。/);
      f.place.summary = '';
      await assert.rejects(map.select(f.place), /Canvas omitted/);
      assert.equal(intro.textContent, ''); assert.equal(intro.hidden, true);
      await f.document.click({ ljMap: 'read' });
      assert.equal(f.opened.at(-1), f.place, 'points without a body still open their information');
      if (layout !== 'desktop') assert.equal(f.node('#mainPlaceDetail').textContent, '详情');
    } finally { map?.destroy(); f.restore(); }
  }
});

test('desktop search selection restores the approved action row and full-map reading stays in expanded details', async () => {
  const f = fixture('desktop'); let map;
  f.ui.state.mapUi = { mode: 'detail', full: true, details: false, query: '公园', history: [] };
  try {
    map = mountMap(f.ui); await assert.rejects(map.select(f.place), /Canvas omitted/);
    f.node('.side7 .detail7').hidden = true;
    const read = f.node('.side7 .action7.primary');
    assert.equal(read.parentElement, f.node('.side7 .create7'));
    assert.equal(read.dataset.ljMap, 'read');
    const compact = f.node('#mapCompact7').innerHTML;
    assert.match(compact, /data-lj-map="read"[^>]*>查看详情/);
    assert.equal((compact.match(/data-lj-map="read"/g) || []).length, 1);
    assert(compact.indexOf('data-lj-map="read"') > compact.indexOf('<div class="map-compact-actions"'));
    assert.match(compact, /class="lj-full-detail" hidden/);
    await f.document.click({ ljMap: 'search-choose', mapEntity: f.place.id });
    assert.equal(f.ui.state.mapUi.query, '');
    assert.equal(f.node('.side7 .detail7').hidden, false);
    await f.document.click({ ljMap: 'details' });
    assert.doesNotMatch(f.node('#mapCompact7').innerHTML, /class="lj-full-detail" hidden/);
    await f.document.click({ ljMap: 'read' });
    assert.equal(f.opened.at(-1), f.place);
  } finally { map?.destroy(); f.restore(); }
});

test('region details restore the administrative path and related navigation while rejecting stale related responses', async () => {
  for (const layout of ['desktop', 'portrait', 'mobile']) {
    const f = fixture(layout);
    try {
    const browser = mountBrowser(f.ui), root = f.node(layout === 'desktop' ? '#ljLocationsPage' : '[data-page-root="region"]');
    await browser.render();
    await root.click({ select: f.place.id });
    const detail = f.node(layout === 'desktop' ? '#loc10DetailBody' : 'inline-detail');
    assert.match(detail.innerHTML, /data-enter="pref:13"[^>]*>东京都/);
    assert.match(detail.innerHTML, /data-enter="ward:港"[^>]*>港区/);
    assert.equal(f.pending.has(f.place.id), true);
    await root.click({ select: f.peer.id });
    f.pending.get(f.peer.id)([f.place]); await settle();
    f.pending.get(f.place.id)([f.peer]); await settle();
    const related = f.node('[data-browse-related]');
    assert.match(related.innerHTML, /data-browse-related-id="place:new"/);
    assert.match(related.innerHTML, /相关地点 1 个：/);
    assert.match(related.innerHTML, /新收录公园/);
    assert.doesNotMatch(related.innerHTML, /草地环绕池塘|lj-body-list|lj-meta/);
    assert.doesNotMatch(related.innerHTML, /data-browse-related-id="place:peer"/);
    await root.click({ browseRelatedId: f.place.id });
    assert.equal(f.ui.state.selected.id, f.place.id);
    assert.match(detail.innerHTML, /新收录公园/);
    f.ui.reader.close = async () => false;
    await root.click({ browseRelatedId: f.peer.id });
    assert.equal(f.ui.state.selected.id, f.place.id);
    assert.deepEqual(f.errors, []);
    } finally { f.restore(); }
  }
});

test('full-name detail ancestry keeps its navigation context while narrow breadcrumbs shorten Unicode labels only', async () => {
  for (const layout of ['desktop','portrait','mobile']) {
    const f=fixture(layout),catalog=f.ui.bridge.catalog;
    f.pref.name='𠮷田市特别行政区域';
    catalog.navigationPath=async id=>id==='root'?[]:id===f.pref.id?[f.pref]:id===f.ward.id?[f.pref,f.ward]:[f.pref,f.ward,f.place];
    try {
      const browser=mountBrowser(f.ui),root=f.node(layout==='desktop'?'#ljLocationsPage':'[data-page-root="region"]');
      await browser.render();await root.click({select:f.place.id});
      const detail=f.node(layout==='desktop'?'#loc10DetailBody':'inline-detail').innerHTML;
      assert.match(detail,/<nav class="lj-detail-path"/);
      assert.match(detail,/class="lj-detail-ancestor"[^>]*>𠮷田市特别行政区域<\/button>/);
      const ancestor=detail.match(/class="lj-detail-ancestor" data-enter="pref:13" data-path="([^"]+)"/);
      assert(ancestor);
      const context=ancestor[1].replaceAll('&quot;','"');
      assert.deepEqual(JSON.parse(context),[f.pref.id]);
      await root.click({enter:f.pref.id,path:context});
      assert.equal(f.ui.state.browser.current,f.pref.id);
      assert.deepEqual(f.ui.state.browser.pathIds,[f.pref.id]);
      const crumb=f.node(layout==='desktop'?'#loc10ListHead':'#regionCrumb').innerHTML;
      if(layout==='desktop') {
        assert.match(crumb,/>𠮷田市特别行政区域<\/button>/);
        assert.doesNotMatch(crumb,/lj-crumb-step/);
        assert.doesNotMatch(crumb,/data-action="browse-add"/);
      }else {
        assert.match(crumb,/class="lj-crumb-label">𠮷田市<\/span><span class="lj-crumb-more" aria-hidden="true">…/);
        assert.match(crumb,/title="𠮷田市特别行政区域" aria-label="𠮷田市特别行政区域" aria-current="location"/);
        assert.doesNotMatch(crumb,/data-action="browse-add"/);
        assert.equal(f.node('#regionDrawerCrumb').innerHTML,crumb);
        assert.equal(f.node('#regionSearch').placeholder,'搜索名称、别名、类型');
        assert.equal(f.node('#regionSearch')['aria-label'],'搜索地点、地区、原名、别名或类型');
      }
      assert.deepEqual(f.errors,[]);
    }finally {f.restore();}
  }
});
