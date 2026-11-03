import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/legacy/engine.js';
import textScript from '../src/legacy/text-script.js';
import { mountMaterials } from '../ui/materials.js';

const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

// Only the DOM, clock and host boundary are doubles; material rendering and search are real.
function fixture(t) {
  const previous = { document: globalThis.document, window: globalThis.window, CSS: globalThis.CSS };
  const nodes = new Map(), created = [], timers = new Map(), errors = [];
  let now = 0, nextTimer = 0;
  t.mock.method(globalThis, 'setTimeout', (callback, delay = 0) => { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id; });
  t.mock.method(globalThis, 'clearTimeout', id => timers.delete(id));
  function node(key) {
    if (nodes.has(key)) return nodes.get(key);
    const handlers = new Map();
    let html = '';
    const element = {
      key, value: '', textContent: '', checked: false, scrollTop: 0, writes: 0, dataset: {},
      classList: { add() {}, toggle() {}, remove() {} },
      get innerHTML() { return html; }, set innerHTML(value) { html = value; this.writes++; },
      setAttribute(name, value) { this[name] = value; },
      addEventListener(name, handler) { handlers.set(name, handler); },
      removeEventListener(name) { handlers.delete(name); },
      querySelector(selector) { return node(key + '/' + selector); }, querySelectorAll: () => [],
      closest(selector) { return selector === '[data-page-root]' ? node('root') : selector === 'label' ? node(key + '/label') : null; },
      before() {}, after() {}, append() {}, prepend() {}, remove() {}, scrollIntoView() {},
      async fire(name, event = {}) { await handlers.get(name)?.(event); await settle(); },
      async click(dataset) { await this.fire('click', { target: { closest: () => ({ dataset }) } }); },
    };
    nodes.set(key, element); return element;
  }
  globalThis.document = {
    getElementById: node, head: node('head'),
    createElement(tag) { const element = node('created:' + created.length + ':' + tag); created.push(element); return element; },
  };
  globalThis.window = node('window');
  globalThis.CSS = { escape: value => value };
  const packages = Array.from({ length: 55 }, (_, index) => ({
    id: 'p' + index, layer: 'TN', displayName: index === 54 ? '最新版资料054' : '资料' + String(index).padStart(3, '0'),
    uiGroupId: 'single', fullTriggers: [], aliasTriggers: [], body: '',
  }));
  const data = {
    layerOrder: ['TN', 'EX', 'IN', 'EV'], packages, places: [], adminNodes: [],
    controlGroups: [{ controlGroupId: 'single', label: '资料', mode: 'singleton' }], wrappers: {},
    defaultSettings: { schemaVersion: 4, masterEnabled: true, namedPlaceBodiesEnabled: true, layers: { TN: true, EX: true, IN: true, EV: true }, groups: { single: true }, packages: {} },
  };
  const ui = {
    layout: 'portrait', engine: createEngine(data, {}, {}, textScript),
    state: { materials: { currentId: 'layer:TN', query: '', offset: 24, multi: false, selected: [], modified: false, drill: false, source: null, searchBase: null, highlighted: null } },
    bridge: { store: { read: () => ({ livingJapanSettings: data.defaultSettings, livingJapanTextOverrides: { records: {} } }) } },
    reader: { close: async () => true }, notify: message => errors.push(message), showPage: async () => true,
  };
  const view = mountMaterials(ui), list = node('packageList'), root = node('root');
  const search = created.find(element => element.className?.includes('lj-material-search'));
  const input = search.querySelector('input'), toolbar = created.find(element => element.className?.includes('lj-material-tools'));
  list.scrollTop = 91;
  view.render();
  t.after(() => { globalThis.document = previous.document; globalThis.window = previous.window; globalThis.CSS = previous.CSS; });
  return {
    ui, view, input, list, root, toolbar, errors, window: globalThis.window,
    async tick(milliseconds = 1000) {
      const until = now + milliseconds;
      while (true) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at).find(([, timer]) => timer.at <= until);
        if (!next) break;
        const [id, timer] = next; now = timer.at; timers.delete(id); timer.callback(); await settle();
      }
      now = until; await settle();
    },
  };
}

test('material IME input waits for committed text and paints the compositionend/input pair only once', async t => {
  const f = fixture(t), before = f.list.innerHTML, writes = f.list.writes;
  await f.input.fire('compositionstart');
  f.input.value = 'zui xin'; await f.input.fire('input', { isComposing: true });
  await f.tick();
  assert.equal(f.ui.state.materials.query, '');
  assert.equal(f.list.innerHTML, before);
  assert.equal(f.list.writes, writes);
  f.input.value = '最新版'; await f.input.fire('compositionend');
  await f.input.fire('input', { isComposing: false });
  assert.equal(f.ui.state.materials.query, '最新版', 'navigation sees the committed query immediately');
  assert.equal(f.list.writes, writes, 'typing queues one later paint instead of repainting for both events');
  await f.tick();
  assert.equal(f.list.writes, writes + 1);
  assert.match(f.list.innerHTML, /最新版资料054/);
  assert.match(f.toolbar.innerHTML, /1 项匹配/);
  await f.input.fire('input', { isComposing: false }); await f.tick();
  assert.equal(f.list.writes, writes + 1, 'an unchanged value does not repaint again');
  assert.deepEqual(f.errors, []);
});

test('rapid material input paints only the latest query and clear restores the old page without a timer rebound', async t => {
  const f = fixture(t), original = f.list.innerHTML, writes = f.list.writes;
  for (const value of ['资料0', '资料05', '最新版']) {
    f.input.value = value; await f.input.fire('input', { isComposing: false });
  }
  assert.equal(f.ui.state.materials.query, '最新版');
  assert.equal(f.list.writes, writes);
  await f.tick();
  assert.equal(f.list.writes, writes + 1);
  assert.match(f.list.innerHTML, /最新版资料054/);
  assert.doesNotMatch(f.list.innerHTML, /资料000/);
  f.input.value = '资料05'; await f.input.fire('input', { isComposing: false });
  await f.root.click({ materialAction: 'clear' });
  assert.equal(f.ui.state.materials.query, '');
  assert.equal(f.ui.state.materials.offset, 24);
  assert.equal(f.list.scrollTop, 91);
  assert.equal(f.list.innerHTML, original);
  const clearedWrites = f.list.writes;
  await f.tick();
  assert.equal(f.list.writes, clearedWrites);
  assert.equal(f.list.innerHTML, original);
  f.input.value = '最新版'; await f.input.fire('input', { isComposing: false });
  await f.window.fire('pagehide'); await f.tick();
  assert.equal(f.list.writes, clearedWrites, 'leaving the document cancels its pending paint');
  assert.deepEqual(f.errors, []);
});

test('material navigation and locate consume a pending paint without resetting the destination or return page', async t => {
  const f = fixture(t);
  f.input.value = '资料0'; await f.input.fire('input', { isComposing: false });
  await f.root.click({ materialEnter: 'layer:EX' });
  assert.equal(f.ui.state.materials.currentId, 'layer:EX');
  assert.match(f.list.innerHTML, /当前层暂无直接内容/);
  const entered = f.list.innerHTML, enteredWrites = f.list.writes;
  f.list.scrollTop = 173; await f.tick();
  assert.equal(f.list.innerHTML, entered);
  assert.equal(f.list.writes, enteredWrites);
  assert.equal(f.list.scrollTop, 173);
  await f.root.click({ materialAction: 'source' });
  assert.equal(f.ui.state.materials.query, '资料0');
  assert.match(f.list.innerHTML, /资料000/);
  await f.root.click({ materialAction: 'next' });
  assert.equal(f.ui.state.materials.offset, 24);
  assert.match(f.list.innerHTML, /资料024/);
  f.input.value = '资料'; await f.input.fire('input', { isComposing: false });
  assert.equal(await f.view.locate('p54'), true);
  assert.equal(f.ui.state.materials.offset, 48);
  assert.match(f.list.innerHTML, /最新版资料054/);
  const located = f.list.innerHTML, locatedWrites = f.list.writes;
  f.list.scrollTop = 219; await f.tick();
  assert.equal(f.ui.state.materials.offset, 48);
  assert.equal(f.list.scrollTop, 219);
  assert.equal(f.list.innerHTML, located);
  assert.equal(f.list.writes, locatedWrites);
  assert.deepEqual(f.errors, []);
});

test('a refused material locate leaves the current list and place draft intact', async t => {
  const f = fixture(t);
  const draft = { id: 'place', tab: 'materials', bindings: [{ categoryId: 'draft-term', enabled: true }] };
  f.ui.state.placeEditor = draft;
  f.ui.showPage = async () => false;
  const listState = structuredClone(f.ui.state.materials);
  const rendered = f.list.innerHTML;

  assert.equal(await f.view.locate('p54'), false);
  assert.deepEqual(f.ui.state.materials, listState);
  assert.equal(f.list.innerHTML, rendered);
  assert.equal(f.list.scrollTop, 91);
  assert.equal(f.ui.state.placeEditor, draft);
  assert.deepEqual(draft.bindings, [{ categoryId: 'draft-term', enabled: true }]);
});
