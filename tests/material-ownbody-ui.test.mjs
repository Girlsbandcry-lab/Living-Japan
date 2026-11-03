import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/legacy/engine.js';
import textScript from '../src/legacy/text-script.js';
import { buildMaterialsModel, applyMaterialSelection, materialState, materialBodySelection, mountMaterials } from '../ui/materials.js';
import { materialCategoryNodeId, materialGroupId } from '../src/material-library.js';
import { createMaterialEditor } from '../ui/material-editor.js';
import { createReader } from '../ui/reader.js';

function fixture(extraPackages = []) {
  const categories = { parent: { id: 'parent', name: '有正文的父词条', layer: 'EX', parentId: null }, leaf: { id: 'leaf', name: '可补写末级', layer: 'EX', parentId: 'parent' }, directory: { id: 'directory', name: '纯目录', layer: 'EX', parentId: null, canOwnBody: false } };
  const fragments = Object.fromEntries(['parent', 'leaf'].map(id => [id, { id, title: categories[id].name, categoryId: id, regionId: 'jp', ownBody: true, conditions: {} }]));
  fragments.extra = { id: 'extra', title: '另建片段', categoryId: 'parent', regionId: 'jp', conditions: {} };
  const packages = [...extraPackages, ...Object.values(fragments).map(f => ({ id: 'body:' + f.id, displayName: f.title, layer: 'EX', body: '', materialFragmentId: f.id, controlGroupIds: [materialGroupId('parent'), ...(f.categoryId === 'leaf' ? [materialGroupId('leaf')] : [])], fullTriggers: [], aliasTriggers: [] }))];
  const controlGroups = Object.values(categories).map(c => ({ controlGroupId: materialGroupId(c.id), label: c.name, layer: 'EX' }));
  const data = { layerOrder: ['TN', 'EX', 'IN', 'EV'], packages, places: [], adminNodes: [], wrappers: {}, controlGroups, editableTextSlots: { slots: Object.fromEntries(packages.map(p => ['P/' + p.id, { packageId: p.id, bodySha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }])) }, materialLibrary: { categories, regions: { jp: { id: 'jp', name: '明确适用全国' } }, fragments, places: {}, bindings: {} }, defaultSettings: { masterEnabled: true, layers: { TN: true, EX: true, IN: true, EV: true }, groups: Object.fromEntries(controlGroups.map(g => [g.controlGroupId, true])), packages: {} } };
  return createEngine(data, {}, {}, textScript);
}

test('a term owns one body on its existing node while separately added fragments remain children', () => {
  const model = buildMaterialsModel(fixture()), parent = model.nodes.get(materialCategoryNodeId('parent')), leaf = model.nodes.get(materialCategoryNodeId('leaf'));
  assert.equal(parent.packageId, 'body:parent');
  assert.equal(leaf.packageId, 'body:leaf');
  assert.equal(model.packageNodes.get('body:parent'), parent);
  assert.equal(model.packageNodes.get('body:leaf'), leaf);
  assert.equal(parent.children.length, 2);
  assert.equal(leaf.children.length, 0);
  assert.equal(model.search('可补写末级').length, 1);
  assert.equal(model.nodes.get(materialCategoryNodeId('directory')).packageId, undefined);
});

test('own-body and branch selection are independent and search bulk only changes selected bodies', () => {
  const engine = fixture(), model = buildMaterialsModel(engine), parent = model.nodes.get(materialCategoryNodeId('parent')), leaf = model.nodes.get(materialCategoryNodeId('leaf'));
  const initial = engine.normalizeSettings(engine.data.defaultSettings);
  const bodyOff = applyMaterialSelection(initial, [parent], false, 'body');
  assert.equal(bodyOff.packages['body:parent'], false);
  assert.equal(materialState(leaf, bodyOff, model, 'body').effective, true);
  assert.equal(materialState(parent, bodyOff, model, 'body').own, false);
  const branchOff = applyMaterialSelection(bodyOff, [parent], false, 'branch');
  assert.equal(materialState(leaf, branchOff, model, 'body').effective, false);
  assert.equal(materialState(leaf, branchOff, model, 'body').own, true);
  const reopened = applyMaterialSelection(branchOff, [parent], true, 'branch');
  assert.equal(reopened.packages['body:parent'], false);
  const selected = materialBodySelection([parent, model.roots[1]]);
  assert.deepEqual(selected, [parent]);
  const multi = applyMaterialSelection(reopened, selected, true, 'body');
  assert.deepEqual(multi.groups, reopened.groups);
});

function mountFixture(t, engine = fixture()) {
  const old = { document: globalThis.document, window: globalThis.window, CSS: globalThis.CSS }, nodes = new Map(), created = [], opened = [], errors = [];
  function node(key) {
    if (nodes.has(key)) return nodes.get(key);
    const handlers = new Map(), n = { key, dataset: {}, value: '', checked: false, scrollTop: 0, innerHTML: '', classList: { add() {}, toggle() {}, remove() {} }, setAttribute() {}, before() {}, after() {}, append() {}, remove() {}, scrollIntoView() {}, closest: selector => selector === '[data-page-root]' ? node('root') : selector === 'label' ? node(key + '/label') : null, querySelector: selector => node(key + '/' + selector), querySelectorAll: () => [], addEventListener: (event, fn) => handlers.set(event, fn), async click(dataset) { await handlers.get('click')?.({ target: { closest: () => ({ dataset }) } }); } };
    n.prepend = () => {};
    nodes.set(key, n); return n;
  }
  globalThis.document = { getElementById: node, head: node('head'), createElement: tag => { const n = node('created:' + created.length + ':' + tag); created.push(n); return n; } };
  globalThis.window = { addEventListener() {} }; globalThis.CSS = { escape: value => value };
  const container = { livingJapanSettings: engine.normalizeSettings(engine.data.defaultSettings), livingJapanTextOverrides: { records: {} } };
  let readerRenders = 0, mayLeave = true;
  const ui = { engine, layout: 'portrait', state: { materials: { currentId: materialCategoryNodeId('parent'), query: '', offset: 0, selected: [], multi: false, modified: false, drill: false, source: null, searchBase: null } }, reader: { close: async () => mayLeave, render: () => readerRenders++ }, bridge: { store: { read: () => container }, session: { refresh: async () => {}, runtime: { saveSettings: async value => { container.livingJapanSettings = value; } } } }, showPage: async () => true, getEntityForPackage: id => ({ id, materialFragmentId: id, packageIds: [id] }), openReader: async (_entity, id) => { opened.push(id); return true; }, notify: message => errors.push(message) };
  const view = mountMaterials(ui); view.render();
  t.after(() => Object.assign(globalThis, old));
  return { ui, view, root: node('root'), list: node('packageList'), crumbs: node('packageCrumbs'), sibling: node('packageSibling'), back: node('packageBack'), tools: created.find(n => n.className?.includes('lj-material-tools')), opened, container, errors, readerRenders: () => readerRenders, refuseLeave: () => { mayLeave = false; } };
}

test('leaf reads in place, own switch refreshes the reader, and package locate returns to the containing list', async t => {
  const f = mountFixture(t), parentId = materialCategoryNodeId('parent'), leafId = materialCategoryNodeId('leaf');
  assert.match(f.list.innerHTML, /data-material-read="material::leaf"/);
  assert.doesNotMatch(f.list.innerHTML, /data-material-enter="material::leaf"/);
  assert.match(f.tools.innerHTML, /data-material-scope="body"/);
  f.list.scrollTop = 135;
  await f.root.click({ materialRead: leafId });
  assert.deepEqual(f.opened, ['body:leaf']);
  assert.equal(f.ui.state.materials.currentId, parentId);
  assert.equal(f.list.scrollTop, 135);
  await f.root.click({ materialToggle: leafId, materialScope: 'body' });
  assert.equal(f.container.livingJapanSettings.packages['body:leaf'], false);
  assert.ok(f.readerRenders() > 0);
  await f.view.locate('body:leaf');
  assert.equal(f.ui.state.materials.currentId, parentId);
  assert.equal(f.ui.state.materials.highlighted, leafId);
  f.refuseLeave();
  await f.root.click({ materialEnter: 'layer:EX' });
  assert.equal(f.ui.state.materials.currentId, parentId);
});

test('only modified terms are listed and a place body cannot redirect the term list', async t => {
  const engine = fixture([{ id: 'place-body', layer: 'EX', displayName: '地点正文样本', placeId: 'place:sample', uiGroupId: 'place-group', body: '' }]);
  const f = mountFixture(t, engine);
  for (const id of ['body:leaf', 'place-body']) {
    const variant = engine.editableVariantsForPackage(id)[0];
    f.container.livingJapanTextOverrides.records[variant.slotKey] = engine.createOverrideRecord(variant, '修改稿');
  }
  f.ui.state.materials.modified = true;
  f.view.render();
  assert.match(f.list.innerHTML, /可补写末级/);
  assert.doesNotMatch(f.list.innerHTML, /地点正文样本/);
  assert.equal(await f.view.locate('place-body'), false);
  assert.equal(f.ui.state.materials.currentId, materialCategoryNodeId('parent'));
});

test('old paused leaf branches remain recoverable rather than silently clearing saved settings', t => {
  const f = mountFixture(t), leafId = materialCategoryNodeId('leaf');
  f.container.livingJapanSettings.groups[materialGroupId('leaf')] = false;
  f.view.render();
  assert.match(f.list.innerHTML, /data-material-toggle="material::leaf"[^>]*data-material-scope="branch"/);
  assert.equal(f.container.livingJapanSettings.groups[materialGroupId('leaf')], false);
});

test('material navigation omits the full clickable path while retaining sibling and up-level controls', async t => {
  const f = mountFixture(t);
  assert.equal(f.crumbs.hidden, true);
  assert.equal(f.crumbs.innerHTML, '');
  assert.match(f.sibling.innerHTML, /有正文的父词条/);
  assert.equal(f.back.textContent, '← 上一级');
  assert.match(f.tools.innerHTML, /有正文的父词条/);
  await f.back.onclick();
  assert.equal(f.ui.state.materials.currentId, 'layer:EX');
  assert.equal(f.crumbs.innerHTML, '');
});

test('returning from a located search result uses one back control and restores the original query and scroll', async t => {
  const f = mountFixture(t);
  Object.assign(f.ui.state.materials, { query: '词条', drill: true, source: { currentId: 'layer:EX', query: '词条', offset: 0, modified: false, highlighted: null, drill: false, source: null, scrollTop: 77, mode: 'search' } });
  f.view.render();
  assert.equal(f.back.textContent, '← 返回搜索');
  assert.doesNotMatch(f.tools.innerHTML, /data-material-action="source"|返回搜索/);
  await f.back.onclick();
  assert.equal(f.ui.state.materials.query, '词条');
  assert.equal(f.ui.state.materials.drill, false);
  assert.equal(f.ui.state.materials.source, null);
  assert.equal(f.list.scrollTop, 77);
});

test('own weather conditions keep category name and regional identity out of editable fragment fields', async () => {
  const fragment = { id: 'own-weather', ownBody: true, title: '雨', categoryId: 'rain', regionId: 'north', familyId: 'own-rain', conditions: {} };
  const library = { categories: { rain: { id: 'rain', name: '雨', layer: 'TN' } }, regions: { north: { id: 'north', name: '北海道' } }, fragments: { [fragment.id]: fragment }, places: {}, bindings: {} };
  let fields;
  const editor = createMaterialEditor({ engine: { data: { materialLibrary: library } }, reader: { leave: async () => true }, ask: async spec => { fields = spec.fields.map(f => f.id); return { id: 'cancel' }; } });
  await editor.editFragment(fragment.id);
  assert.ok(fields.includes('months'));
  assert.ok(!fields.includes('title'));
  assert.ok(!fields.includes('regionId'));
  assert.ok(!fields.includes('familyId'));
});

for (const layout of ['desktop', 'portrait', 'mobile']) test(`${layout} term reader edits, protects a dirty draft, saves and restores the same body without creating a place slot`, async t => {
  const old = { document: globalThis.document, window: globalThis.window }, overlays = [], answers = [], notices = [];
  const host = { append(n) { n.parentElement = host; if (n.className === 'lj-reader-overlay') overlays.push(n); }, classList: { add() {}, remove() {} }, closest: () => null };
  const node = () => {
    const handlers = new Map(), elements = new Map();
    return { innerHTML: '', classList: { add() {}, remove() {} }, setAttribute() {}, remove() {}, querySelectorAll: () => [],
      querySelector(selector) { if (!elements.has(selector)) elements.set(selector, { scrollTop: 0, selectionStart: 0, selectionEnd: 0, setSelectionRange() {}, focus() {} }); return elements.get(selector); },
      addEventListener: (name, fn) => handlers.set(name, fn),
      async action(action) { await handlers.get('click')({ target: { closest: () => ({ dataset: { reader: action } }) } }); },
      async input(value) { await handlers.get('input')({ target: { value, matches: selector => selector === 'textarea' } }); },
    };
  };
  globalThis.document = { body: host, head: host, activeElement: null, createElement: node, querySelector: () => host, querySelectorAll: () => [] };
  globalThis.window = { addEventListener() {} };
  t.after(() => Object.assign(globalThis, old));
  const engine = fixture(), container = { livingJapanSettings: engine.normalizeSettings(engine.data.defaultSettings), livingJapanTextOverrides: { records: {} } };
  const ui = { layout, state: { page: 'package' }, placeEditor: { open() { throw new Error('Term editing must not open the place editor'); } }, bridge: { store: { read: () => container }, session: { engine, runtime: {
    async saveTextOverride(packageId, _calendar, body) { const variant = engine.editableVariantsForPackage(packageId)[0]; container.livingJapanTextOverrides.records[variant.slotKey] = engine.createOverrideRecord(variant, body); },
    async removeTextOverride(packageId) { delete container.livingJapanTextOverrides.records['P/' + packageId]; },
    async saveSettings(settings) { container.livingJapanSettings = settings; },
  } } }, notify: message => notices.push(message), refresh: async () => {}, ask: async () => { assert.ok(answers.length); return answers.shift(); } };
  const reader = createReader(ui), parent = { id: 'fragment:parent', name: '父词条', materialFragmentId: 'parent', packageIds: ['body:parent'] }, leaf = { id: 'fragment:leaf', name: '末级', materialFragmentId: 'leaf', packageIds: ['body:leaf'] };
  await reader.open(parent, 'body:parent');
  let overlay = overlays.at(-1);
  assert.match(overlay.innerHTML, /可以补写/);
  assert.match(overlay.innerHTML, /data-reader="material"[^>]*>在列表中定位/);
  assert.doesNotMatch(overlay.innerHTML, /data-reader="region"/);
  await overlay.action('edit'); await overlay.input('该词条的个人正文');
  assert.equal(reader.isDirty(), true);
  answers.push('cancel'); assert.equal(await reader.open(leaf, 'body:leaf'), false);
  assert.equal(reader.viewState().slotKey, 'P/body:parent');
  await overlay.action('save');
  assert.equal(reader.isDirty(), false);
  assert.equal(container.livingJapanTextOverrides.records['P/body:parent'].body, '该词条的个人正文');
  await overlay.action('toggle');
  assert.equal(container.livingJapanSettings.packages['body:parent'], false);
  assert.match(overlay.innerHTML, /aria-label="本级正文开关" aria-pressed="false"/);
  assert.equal(container.livingJapanSettings.packages['body:leaf'], undefined, 'the untouched default-enabled child has no new override');
  await reader.close(); await reader.open(parent, 'body:parent'); overlay = overlays.at(-1);
  assert.match(overlay.innerHTML, /该词条的个人正文/);
  answers.push('restore'); await overlay.action('restore');
  assert.equal(container.livingJapanTextOverrides.records['P/body:parent'], undefined);
  assert.equal(container.livingJapanSettings.packages['body:parent'], false, 'restoring text does not turn on the body');
  assert.equal(answers.length, 0);
});
