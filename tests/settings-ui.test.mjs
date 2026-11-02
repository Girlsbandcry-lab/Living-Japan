import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSettings } from '../ui/settings.js';

const clone = value => JSON.parse(JSON.stringify(value));
const decode = value => String(value).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const dataKey = name => name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

function element(tagName = 'div', attributes = {}, parent = null) {
  const node = { tagName: tagName.toUpperCase(), attributes: { ...attributes }, parentElement: parent, children: [], handlers: {}, dataset: {}, scrollTop: 0, textContent: '', value: attributes.value || '', disabled: false, hidden: 'hidden' in attributes, open: 'open' in attributes, style: {} };
  for (const [name, value] of Object.entries(attributes)) if (name.startsWith('data-')) node.dataset[dataKey(name)] = value;
  node.classList = {
    contains: name => (node.attributes.class || '').split(/\s+/).includes(name),
    add(...names) { node.attributes.class = [...new Set([...(node.attributes.class || '').split(/\s+/).filter(Boolean), ...names])].join(' '); },
    remove(...names) { node.attributes.class = (node.attributes.class || '').split(/\s+/).filter(name => !names.includes(name)).join(' '); },
    toggle(name, on = !this.contains(name)) { if (on) this.add(name); else this.remove(name); return on; },
  };
  node.setAttribute = (name, value) => { node.attributes[name] = String(value); if (name.startsWith('data-')) node.dataset[dataKey(name)] = String(value); };
  node.getAttribute = name => node.attributes[name] ?? null;
  node.hasAttribute = name => name in node.attributes;
  node.matches = selector => selector.split(',').some(part => {
    const simple = part.trim();
    const outsideAttributes = simple.replace(/\[[^\]]*\]/g, '');
    const tag = outsideAttributes.match(/^[a-z][\w-]*/i)?.[0];
    if (tag && tag.toUpperCase() !== node.tagName) return false;
    const id = outsideAttributes.match(/#([\w-]+)/)?.[1];
    if (id && node.attributes.id !== id) return false;
    if ([...outsideAttributes.matchAll(/\.([\w-]+)/g)].some(match => !node.classList.contains(match[1]))) return false;
    return [...simple.matchAll(/\[([^=\]\s]+)(?:=["']?([^\]"']*)["']?)?\]/g)].every(([, name, value]) => name in node.attributes && (value === undefined || node.attributes[name] === value));
  });
  node.closest = selector => node.matches(selector) ? node : node.parentElement?.closest(selector) || null;
  node.querySelectorAll = selector => node.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  node.querySelector = selector => node.querySelectorAll(selector)[0] || null;
  node.contains = other => Boolean(other && (other === node || node.children.some(child => child.contains(other))));
  node.addEventListener = (name, handler) => { (node.handlers[name] ||= []).push(handler); };
  node.removeEventListener = (name, handler) => { node.handlers[name] = (node.handlers[name] || []).filter(value => value !== handler); };
  node.getBoundingClientRect = () => ({ top: node.parentElement ? node.parentElement.children.indexOf(node) * 100 : 0, height: 100 });
  node.scrollIntoView = () => { if (node.parentElement) node.parentElement.scrollTop = node.getBoundingClientRect().top; };
  node.focus = () => { globalThis.document.activeElement = node; };
  node.append = (...children) => { for (const child of children) { child.parentElement = node; node.children.push(child); } };
  node.remove = () => { if (node.parentElement) node.parentElement.children = node.parentElement.children.filter(child => child !== node); node.parentElement = null; };
  node.showModal = () => { node.open = true; };
  node.close = () => { node.open = false; };
  let html = '';
  Object.defineProperty(node, 'innerHTML', { get: () => html, set(value) {
    html = value; node.children = [];
    const stack = [node];
    for (const match of value.matchAll(/<\/?([a-z][\w-]*)([^>]*)>/gi)) {
      const tag = match[1].toLowerCase();
      if (match[0].startsWith('</')) { if (stack.length > 1 && stack.at(-1).tagName === tag.toUpperCase()) stack.pop(); continue; }
      const attrs = {};
      for (const attr of match[2].matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[attr[1]] = decode(attr[2] ?? attr[3] ?? attr[4] ?? '');
      const child = element(tag, attrs, stack.at(-1)); stack.at(-1).children.push(child);
      if (!['input', 'br', 'hr', 'img', 'meta', 'link'].includes(tag)) stack.push(child);
    }
  } });
  return node;
}

function settingsFixture(layout = 'portrait', extraBridge = {}) {
  const previous = globalThis.document, content = element(), tabs = element(), heading = element('span', { id: 'set12Headnote' }), page = element('section', { 'data-page-root': 'settings' });
  page.children.push(tabs, content); tabs.parentElement = page; content.parentElement = page;
  const savedSettings = { textScript: 'simplified', wrapperMode: 'standard', historyDepth: 2, currentUserBoundary: { start: '', end: '' }, channelTags: Object.fromEntries(['TN', 'EX', 'IN', 'EV'].map(key => [key, { priority: [], excluded: [] }])), layers: { TN: true, EX: true, IN: true, EV: true }, masterEnabled: true, namedPlaceBodiesEnabled: true, diagnostics: false };
  let saved = { livingJapanSettings: savedSettings, livingJapanTextOverrides: { records: {}, orphans: {} }, extensionUi: { pinned: false, favorites: [{ slotId: 'favorite_1', displayName: '家', entityId: 'station:tokyo', name: '东京站', regionCode: '13' }] } };
  const writes = [], asks = [], notices = [];
  const roots = new Map([[layout === 'desktop' ? 'set12Content' : 'settingsScroll', content], [layout === 'desktop' ? 'set12Tabs' : 'settingsTabs', tabs]]);
  if (layout === 'desktop') roots.set('set12Headnote', heading);
  globalThis.document = { activeElement: null, body: element('body'), createElement: tag => element(tag), getElementById: id => roots.get(id) || page.querySelector(`#${id}`), querySelector: selector => page.matches(selector) ? page : page.querySelector(selector), querySelectorAll: selector => page.querySelectorAll(selector) };
  const ui = {
    layout, esc: value => String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    state: { regionCode: '13', selected: { id: 'station:tokyo', name: '东京站', regionCode: '13' } },
    engine: { normalizeSettings: value => clone(value), normalizeTextOverrides: value => clone({ records: {}, orphans: {}, ...value }), data: { wrappers: { standard: { label: '标准' }, brief: { label: '精简' } } } },
    bridge: { store: { read: () => clone(saved), async update(change) { const draft = clone(saved); change(draft); saved = draft; writes.push(clone(saved)); } }, session: { async refresh() {} }, catalog: { get: id => id === 'station:tokyo' ? { id, name: '东京站', regionCode: '13' } : null, async search() { return []; } } },
    ask: async options => { asks.push(options); return 'cancel'; }, notify: (...args) => notices.push(args),
  };
  ui.bridge.session.runtime = { saveSettings: value => ui.bridge.store.update(draft => { draft.livingJapanSettings = ui.engine.normalizeSettings(value); }) };
  Object.assign(ui.bridge, extraBridge);
  const view = mountSettings(ui);
  async function dispatch(host, name, target) { for (const handler of host.handlers[name] || []) await handler({ target, preventDefault() {} }); }
  const control = selector => { const found = content.querySelector(selector); assert.ok(found, `Expected live settings control ${selector}`); return found; };
  return {
    content, tabs, heading, view, writes, asks, notices, ui, saved: () => clone(saved), control,
    async input(selector, value) { const target = control(selector); target.value = value; await dispatch(content, 'input', target); return target; },
    async click(selector) { await dispatch(content, 'click', control(selector)); },
    async clickHeading() { await dispatch(heading, 'click', heading.querySelector('[data-settings-action="open-update-section"]')); },
    async tab(id) { const target = tabs.querySelector(`[data-lj-settings-tab="${id}"]`); assert.ok(target); await dispatch(tabs, 'click', target); },
    restore() { globalThis.document = previous; },
  };
}

test('asynchronous package update notice changes only its status nodes and retains live settings drafts', async () => {
  let notify, checks = 0, summary = { available: false, checking: false, items: [] };
  const manager = { getUpdateSummary: () => summary, subscribeUpdates(fn) { notify = fn; return () => {}; }, async refreshCatalog() { checks++; } };
  const f = settingsFixture('mobile', { packages: { manager } });
  try {
    f.view.openTab('reading'); await f.input('[data-settings-reading="historyDepth"]', '9');
    f.view.openTab('favorites');
    const favorite = await f.input('[data-favorite-index="0"][data-favorite-field="displayName"]', '未保存家');
    const search = await f.input('[data-map-point-search]', '咖啡');
    f.content.scrollTop = 432;
    assert.equal(typeof notify, 'function');
    summary = { available: true, checking: false, items: [{ id: 'metro', name: '首都圈', changes: ['indexes'], version: '2', downloadBytes: 250 }], notice: '作者通知', changelog: [{version:'2',summary:'本次说明',details:'完整说明'}] }; notify(summary);
    assert.equal(f.control('[data-favorite-index="0"][data-favorite-field="displayName"]'), favorite);
    assert.equal(f.control('[data-map-point-search]'), search); assert.equal(search.value, '咖啡');
    assert.equal(f.content.scrollTop, 432); assert.equal(f.view.hasUnsaved(), true); assert.equal(f.writes.length, 0);
    await f.click('[data-settings-action="open-update-section"]');
    assert.equal(f.asks.length, 0);
    assert.equal(f.control('[data-package-update-note]').textContent, '首都圈 · 版本 2 · 本次下载 250 B');
    assert.equal(f.control('[data-update-summary]').textContent, '本次说明');
    assert.equal(f.control('[data-update-notice]').textContent, '作者通知');
    await f.click('[data-settings-action="check-pack-updates"]'); assert.equal(checks, 1);
    f.view.openTab('reading'); assert.equal(f.control('[data-settings-reading="historyDepth"]').value, '9');
    f.view.openTab('favorites'); assert.equal(f.control('[data-favorite-index="0"][data-favorite-field="displayName"]').value, '未保存家');
  } finally { f.restore(); }
});

test('desktop update heading opens the existing backup tab without discarding drafts or asking to leave', async () => {
  let notify;
  const manager = { getUpdateSummary: () => ({available:false,items:[]}), subscribeUpdates(fn) { notify = fn; return () => {}; } };
  const f = settingsFixture('desktop', { packages: { manager } });
  try {
    f.view.openTab('reading'); await f.input('[data-settings-reading="historyDepth"]', '9');
    const input = f.control('[data-settings-reading="historyDepth"]');
    notify({available:true,items:[{id:'metro',name:'首都圈',version:'2',downloadBytes:250}]});
    assert.equal(f.control('[data-settings-reading="historyDepth"]'), input);
    assert.ok(f.heading.querySelector('[data-settings-action="open-update-section"]'));
    await f.clickHeading(); assert.ok(f.control('[data-package-update-note]'));
    assert.equal(f.asks.length, 0); assert.equal(f.writes.length, 0);
    f.view.openTab('reading'); assert.equal(f.control('[data-settings-reading="historyDepth"]').value, '9');
    assert.equal(f.view.hasUnsaved(), true);
  } finally { f.restore(); }
});

test('update log displays multiple plain-text releases and restores focus after Escape', async () => {
  const summary = { available: false, items: [], notice: '作者通知', changelog: [
    { version: '2', summary: '增加已审收地区', details: '第一行\n第二行 <script>不会执行</script>' },
    { version: '1', summary: '首版资料', details: '初次发布完整说明' },
  ] };
  const f = settingsFixture('mobile', { packages: { manager: { getUpdateSummary: () => summary } } });
  try {
    f.view.openTab('backup');
    const trigger = f.control('[data-settings-action="update-log"]'); trigger.focus();
    await f.click('[data-settings-action="update-log"]');
    const dialog = document.body.querySelector('dialog');
    assert.equal(dialog.open, true); assert.equal(dialog.querySelectorAll('article').length, 2);
    assert.equal(dialog.querySelectorAll('details').length, 2); assert.equal(dialog.querySelectorAll('script').length, 0);
    assert.match(dialog.innerHTML, /增加已审收地区/); assert.match(dialog.innerHTML, /初次发布完整说明/);
    assert.equal(document.activeElement, dialog.querySelector('[data-update-log-close]'));
    for (const handler of dialog.handlers.cancel) handler({ preventDefault() {} });
    assert.equal(document.body.querySelector('dialog'), null); assert.equal(document.activeElement, trigger);
    assert.equal(f.writes.length, 0);
  } finally { f.restore(); }
});

test('program update row shows the installed public version and never substitutes an internal hash', () => {
  const f=settingsFixture('mobile',{updates:{getState:()=>({available:true,supported:true,version:'v20261102',currentCommitHash:'a'.repeat(40)})}});
  try {f.view.openTab('backup');assert.match(f.control('[data-program-update-note]').textContent,/当前版本 v20261102/);assert.doesNotMatch(f.control('[data-program-update-note]').textContent,/[a-f0-9]{40}/);}
  finally {f.restore();}
});

test('peer living-area introductions switch saves immediately without changing another setting', async () => {
  const f = settingsFixture();
  try {
    assert.equal(f.control('[data-settings-common="expandPeerLivingAreas"]').getAttribute('aria-pressed'), 'false');
    await f.click('[data-settings-common="expandPeerLivingAreas"]');
    assert.equal(f.saved().livingJapanSettings.expandPeerLivingAreas, true);
    assert.equal(f.saved().livingJapanSettings.masterEnabled, true);
    await f.click('[data-settings-common="expandPeerLivingAreas"]');
    assert.equal(f.saved().livingJapanSettings.expandPeerLivingAreas, false);
  } finally { f.restore(); }
});

for (const layout of ['desktop', 'portrait', 'mobile']) {
  test(`${layout} settings shows only the selected page and preserves unsaved drafts across tabs`, async () => {
    const f = settingsFixture(layout);
    try {
      f.control('[data-settings-common="pinned"]');
      assert.equal(f.content.querySelector('[data-settings-reading="historyDepth"]'), null);
      assert.equal(f.content.querySelector('[data-favorite-field="displayName"]'), null);
      assert.equal(f.content.querySelector('[data-map-point-settings]'), null);
      await f.tab('reading');
      await f.input('[data-settings-reading="historyDepth"]', '5');
      assert.equal(f.content.querySelector('[data-settings-common="pinned"]'), null);
      await f.tab('favorites');
      await f.input('[data-favorite-index="0"][data-favorite-field="displayName"]', '新家');
      f.control('[data-map-point-settings]');
      assert.equal(f.content.querySelector('[data-settings-reading="historyDepth"]'), null);
      await f.tab('backup'); f.control('[data-settings-action="export"]');
      assert.equal(f.content.querySelector('[data-favorite-field="displayName"]'), null);
      await f.tab('reading'); assert.equal(f.control('[data-settings-reading="historyDepth"]').value, '5');
      await f.tab('favorites'); assert.equal(f.control('[data-favorite-index="0"][data-favorite-field="displayName"]').value, '新家');
      assert.equal(f.view.hasUnsaved(), true); assert.equal(f.writes.length, 0);
    } finally { f.restore(); }
  });
}

for (const layout of ['desktop', 'portrait', 'mobile']) {
  test(`${layout} category panels share navigation while saving exact quotas independently of map visibility and other drafts`, async () => {
    const f = settingsFixture(layout);
    try {
      f.view.openTab('reading'); await f.input('[data-settings-reading="historyDepth"]', '7');
      f.view.openTab('favorites'); await f.input('[data-favorite-index="0"][data-favorite-field="displayName"]', '暂存家');
      await f.click('[data-place-category-mode="introductions"]');
      assert.equal(f.content.querySelector('[data-map-point-category]'), null);
      assert.equal(f.control('[data-peer-place-quota="in.food"]').value, '5');
      const parent = await f.input('[data-peer-place-quota="in.food"]', '0');
      for (const handler of f.content.handlers.change || []) await handler({ target: parent, preventDefault() {} });
      assert.equal(f.saved().livingJapanSettings.peerPlaceQuotas['in.food'], 0);
      assert.equal(f.control('[data-peer-place-quota="in.food.cafe"]').value, '5');
      assert.equal(f.saved().extensionUi.mapPointVisibility, undefined);
      const cafe = await f.input('[data-peer-place-quota="in.food.cafe"]', '3');
      for (const handler of f.content.handlers.change || []) await handler({ target: cafe, preventDefault() {} });
      assert.equal(f.saved().livingJapanSettings.peerPlaceQuotas['in.food.cafe'], 3);
      await f.input('[data-map-point-search]', '咖啡');
      await f.click('[data-place-category-mode="map"]');
      assert.equal(f.control('[data-map-point-search]').value, '咖啡');
      assert.equal(f.content.querySelector('[data-peer-place-quota]'), null);
      await f.click('[data-map-point-category="in.food.cafe"]');
      assert.equal(f.saved().extensionUi.mapPointVisibility['in.food.cafe'], false);
      await f.click('[data-place-category-mode="introductions"]');
      assert.equal(f.control('[data-peer-place-quota="in.food.cafe"]').value, '3');
      const incomplete = await f.input('[data-peer-place-quota="in.food.cafe"]', '');
      for (const handler of f.content.handlers.change || []) await handler({ target: incomplete, preventDefault() {} });
      assert.equal(f.saved().livingJapanSettings.peerPlaceQuotas['in.food.cafe'], 3);
      await f.tab('backup'); await f.tab('favorites');
      assert.equal(f.control('[data-peer-place-quota="in.food.cafe"]').value, '');
      await f.input('[data-map-point-search]', '车站');
      f.control('[data-peer-place-quota="in.transport.station"]');
      assert.equal(f.saved().livingJapanSettings.historyDepth, 2);
      assert.equal(f.saved().extensionUi.favorites[0].displayName, '家');
      assert.equal(f.saved().extensionUi.placeCategoryView.mode, 'introductions');
      await f.tab('reading'); assert.equal(f.control('[data-settings-reading="historyDepth"]').value, '7');
      await f.tab('favorites'); assert.equal(f.control('[data-favorite-index="0"][data-favorite-field="displayName"]').value, '暂存家');
    } finally { f.restore(); }
  });
}

test('reading and favorite settings save independently without losing the other draft', async () => {
  const f = settingsFixture();
  try {
    f.view.openTab('reading'); await f.input('[data-settings-reading="historyDepth"]', '5');
    f.view.openTab('favorites'); await f.input('[data-favorite-index="0"][data-favorite-field="displayName"]', '新家');
    f.view.openTab('reading'); await f.click('[data-settings-action="save-reading"]');
    assert.equal(f.saved().livingJapanSettings.historyDepth, 5);
    assert.equal(f.saved().extensionUi.favorites[0].displayName, '家');
    assert.equal(f.view.hasUnsaved(), true);
    f.view.openTab('favorites'); assert.equal(f.control('[data-favorite-index="0"][data-favorite-field="displayName"]').value, '新家');
    await f.click('[data-settings-action="save-favorites"]');
    assert.equal(f.saved().extensionUi.favorites[0].displayName, '新家');
    assert.equal(f.saved().livingJapanSettings.historyDepth, 5);
    assert.equal(f.writes.length, 2); assert.equal(f.view.hasUnsaved(), false);
  } finally { f.restore(); }
});

test('finishing a second quota while the first save is pending keeps and saves both values', async () => {
  const f = settingsFixture('desktop');
  try {
    f.view.openTab('favorites'); await f.click('[data-place-category-mode="introductions"]');
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const originalSave = f.ui.bridge.session.runtime.saveSettings;
    let first = true;
    f.ui.bridge.session.runtime.saveSettings = async value => { if (first) { first = false; await gate; } return originalSave(value); };
    const parent = await f.input('[data-peer-place-quota="in.food"]', '2');
    const pendingFirst = Promise.all(f.content.handlers.change.map(handler => handler({ target: parent, preventDefault() {} })));
    const cafe = await f.input('[data-peer-place-quota="in.food.cafe"]', '4');
    const pendingSecond = Promise.all(f.content.handlers.change.map(handler => handler({ target: cafe, preventDefault() {} })));
    release(); await Promise.all([pendingFirst, pendingSecond]);
    assert.equal(f.saved().livingJapanSettings.peerPlaceQuotas['in.food'], 2);
    assert.equal(f.saved().livingJapanSettings.peerPlaceQuotas['in.food.cafe'], 4);
    assert.equal(f.view.hasUnsaved(), false);
  } finally { f.restore(); }
});

test('canceling settings leave retains both drafts and performs no save', async () => {
  const f = settingsFixture();
  try {
    f.view.openTab('reading'); await f.input('[data-settings-reading="historyDepth"]', '6');
    f.view.openTab('favorites'); await f.input('[data-favorite-index="0"][data-favorite-field="displayName"]', '候选家');
    assert.equal(await f.view.requestLeave(), false); assert.equal(f.asks.length, 1); assert.equal(f.writes.length, 0);
    f.view.openTab('reading'); assert.equal(f.control('[data-settings-reading="historyDepth"]').value, '6');
    f.view.openTab('favorites'); assert.equal(f.control('[data-favorite-index="0"][data-favorite-field="displayName"]').value, '候选家');
    assert.equal(f.view.hasUnsaved(), true);
  } finally { f.restore(); }
});

test('an immediate common switch saves only that preference and preserves unsaved reading and favorites', async () => {
  const f = settingsFixture();
  try {
    f.view.openTab('reading'); await f.input('[data-settings-reading="historyDepth"]', '7');
    f.view.openTab('favorites'); await f.input('[data-favorite-index="0"][data-favorite-field="displayName"]', '暂存家');
    f.view.openTab('common'); await f.click('[data-settings-common="pinned"]');
    assert.equal(f.saved().extensionUi.pinned, true); assert.equal(f.writes.length, 1);
    assert.equal(f.saved().livingJapanSettings.historyDepth, 2); assert.equal(f.saved().extensionUi.favorites[0].displayName, '家');
    f.view.openTab('reading'); assert.equal(f.control('[data-settings-reading="historyDepth"]').value, '7');
    f.view.openTab('favorites'); assert.equal(f.control('[data-favorite-index="0"][data-favorite-field="displayName"]').value, '暂存家');
    assert.equal(f.view.hasUnsaved(), true);
  } finally { f.restore(); }
});

for (const layout of ['desktop', 'portrait', 'mobile']) {
  test(`${layout} nationwide map-point browser preserves settings, drafts and scroll with bounded batch actions`, async () => {
    const f = settingsFixture(layout);
    try {
      const outer = () => layout === 'desktop' ? f.control('.set12-scroll') : f.content;
      const selectScope = id => f.click(`[data-map-point-select-scope="${id}"]`);
      const selectGroup = async id => {
        if (layout !== 'mobile') return f.click(`[data-map-point-select-group="${id}"]`);
        const target = f.control('select[data-map-point-group-select]');
        target.value = id;
        for (const handler of f.content.handlers.change || []) await handler({ target, preventDefault() {} });
      };
      const selectedGroup = () => layout === 'mobile'
        ? f.control('select[data-map-point-group-select]').querySelector('option[selected]')?.getAttribute('value')
        : f.control('[data-map-point-select-group][aria-pressed="true"]').dataset.mapPointSelectGroup;
      const search = value => f.input('input[data-map-point-search]', value);
      const values = () => f.saved().extensionUi.mapPointVisibility;
      const noSave = async action => {
        const before = f.saved();
        await action();
        const after = f.saved();
        delete before.extensionUi.placeCategoryView; delete after.extensionUi.placeCategoryView;
        assert.deepEqual(after, before, 'browsing may remember the view but must not change functional preferences');
      };

      f.view.openTab('favorites');
      assert.match(f.content.innerHTML, /场馆与店铺/);
      assert.match(f.content.innerHTML, /街区与户外/);
      assert.match(f.content.innerHTML, /通用分类/);
      assert.doesNotMatch(f.content.innerHTML, /首都圈：/);
      assert.ok(f.content.innerHTML.indexOf('data-map-point-settings') < f.content.innerHTML.indexOf('data-favorite-field'));
      assert.equal(f.content.querySelector('[data-settings-common]'), null);
      assert.equal(f.content.querySelectorAll('[data-map-point-all]').length, 2);
      assert(!f.control('[data-map-point-all="show"]').hasAttribute('data-map-point-scope'));
      assert(!f.control('[data-map-point-all="hide"]').hasAttribute('data-map-point-scope'));
      assert(!f.content.querySelector('[data-map-point-category="in.transport.station"]'));
      assert(!f.content.querySelector('[data-map-point-category="in.transport.bus"]'));

      await noSave(async () => { await selectScope('legacy'); await selectGroup('parks-nature'); });
      await f.click('[data-map-point-category="园"]');
      await noSave(async () => { await selectScope('IN'); await selectGroup('in.leisure-faith'); });
      await f.click('[data-map-point-category="in.sports.sauna"]');
      await noSave(() => selectGroup('in.food'));
      assert.match(f.control('[data-map-point-category="in.food"]').getAttribute('aria-label'), /餐饮.*（未细分）/);
      await f.click('[data-map-point-category="in.food"]');
      assert.equal(values()['in.food'], false, 'a parent classification itself remains adjustable');
      assert.equal(values()['in.food.cafe'] !== false, true, 'parent key is not a batch toggle');
      const personalChoices = values();

      await noSave(async () => {
        f.view.openTab('reading'); await f.input('[data-settings-reading="historyDepth"]', '7');
        f.view.openTab('favorites'); await f.input('[data-favorite-index="0"][data-favorite-field="displayName"]', '暂存家');
        f.view.openTab('favorites');
        await selectScope('EX'); await selectGroup('ex.open-space');
        await search('公园');
        f.control('[data-map-point-category="园"]');
        f.control('[data-map-point-category="ex.open-space.city-park"]');
        await search('桑拿');
        assert.equal(f.control('[data-map-point-category="in.sports.sauna"]').getAttribute('aria-pressed'), 'false');
        await search('未细分');
        f.control('[data-map-point-category="in.food"]');
        f.control('[data-map-point-category="ex.open-space"]');
        await f.click('[data-map-point-clear-search]');
      });
      assert.deepEqual(values(), personalChoices);
      assert.equal(selectedGroup(), 'ex.open-space', 'clearing cross-scope search returns to the original group');
      outer().scrollTop = 486;
      if (layout !== 'mobile') f.control('[data-map-point-scroll="groups"]').scrollTop = 61;
      f.control('[data-map-point-scroll="categories"]').scrollTop = 97;
      await f.click('[data-map-point-category="ex.open-space.city-park"]');
      assert.equal(selectedGroup(), 'ex.open-space');
      assert.equal(outer().scrollTop, 486);
      if (layout !== 'mobile') assert.equal(f.control('[data-map-point-scroll="groups"]').scrollTop, 61);
      assert.equal(f.control('[data-map-point-scroll="categories"]').scrollTop, 97);
      assert.equal(values()['ex.open-space.city-park'], false);
      assert.equal(values().园, false);
      assert.equal(values()['in.sports.sauna'], false);
      assert.equal(values()['in.food'], false);

      await noSave(() => search('未细分'));
      outer().scrollTop = 486;
      f.control('[data-map-point-scroll="categories"]').scrollTop = 73;
      await f.click('[data-map-point-category="in.retail"]');
      assert.equal(f.control('input[data-map-point-search]').value, '未细分');
      assert.equal(outer().scrollTop, 486);
      assert.equal(f.control('[data-map-point-scroll="categories"]').scrollTop, 73);
      await noSave(() => f.click('[data-map-point-clear-search]'));
      assert.equal(selectedGroup(), 'ex.open-space');

      await noSave(async () => { await selectScope('IN'); await selectGroup('in.food'); });
      const foodIds = f.content.querySelectorAll('[data-map-point-category]').map(node => node.dataset.mapPointCategory);
      assert.ok(foodIds.includes('in.food') && foodIds.includes('in.food.cafe'));
      const beforeGroup = values();
      await f.click('[data-map-point-toggle-group="in.food"][data-map-point-value="show"]');
      for (const [id, value] of Object.entries(beforeGroup)) assert.equal(values()[id], foodIds.includes(id) ? true : value, id);
      for (const id of foodIds) assert.equal(values()[id], true, id);

      await noSave(() => search('桑拿'));
      await f.click('[data-map-point-all="hide"]');
      assert.equal(Object.keys(values()).length, 289);
      assert.ok(Object.values(values()).every(value => value === false), 'global hide applies beyond search results and active scope');
      assert.equal(f.control('input[data-map-point-search]').value, '桑拿');
      await f.click('[data-map-point-all="show"]');
      assert.equal(Object.keys(values()).length, 289);
      assert.ok(Object.values(values()).every(value => value === true));
      assert.equal(f.control('input[data-map-point-search]').value, '桑拿');
      await noSave(() => f.click('[data-map-point-clear-search]'));
      assert.equal(selectedGroup(), 'in.food');
      await f.click('[data-map-point-toggle-group="in.food"][data-map-point-value="hide"]');
      for (const [id, value] of Object.entries(values())) assert.equal(value, !foodIds.includes(id), id);
      await f.click('[data-map-point-category="in.food.cafe"]');
      for (const [id, value] of Object.entries(values())) assert.equal(value, id === 'in.food.cafe' || !foodIds.includes(id), id);

      assert.equal(f.saved().livingJapanSettings.historyDepth, 2);
      assert.equal(f.saved().extensionUi.favorites[0].displayName, '家');
      assert.equal(f.view.hasUnsaved(), true);
      await noSave(async () => {
        f.view.openTab('reading'); assert.equal(f.control('[data-settings-reading="historyDepth"]').value, '7');
        f.view.openTab('favorites'); assert.equal(f.control('[data-favorite-index="0"][data-favorite-field="displayName"]').value, '暂存家');
      });
    } finally { f.restore(); }
  });
}
