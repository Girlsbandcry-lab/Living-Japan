import test from 'node:test';
import assert from 'node:assert/strict';
import { createBaselineEngine } from '../src/baseline.js';
import { createSession } from '../src/session.js';
import { createUserStore } from '../src/storage.js';
import { materialOwnFragmentId, materialPackageId, materialGroupId, materialLayerGroupId } from '../src/material-library.js';
import { createMaterialEditor } from '../ui/material-editor.js';
import { emptyMaterialRuntime } from './helpers/material-runtime.mjs';

const layers = ['TN', 'EX', 'IN', 'EV'];
function library() {
  return { categories: Object.fromEntries(layers.map(layer => [layer, { id: layer, name: layer + '目录名称', layer, activationKeywords: [layer + '独立词'] }])),
    fragments: Object.fromEntries(layers.map(layer => [layer, { id: layer, title: layer + '情况', categoryId: layer, regionId: '@any', conditions: {} }])),
    places: {}, bindings: {}, regions: {} };
}
function fixture(value = library(), canonical = false) {
  const data = emptyMaterialRuntime();
  if (canonical) data.canonicalPlaceContexts = { aliases: {}, adminNodes: {}, rows: typeof canonical === 'object' ? canonical : {
    shop: { id: 'shop', name: '独立词测试商店', kind: 'poi', sourceIds: ['shop'], regionCode: '13', related: [] }
  } };
  const engine = createBaselineEngine(data, { materialLibrary: value }), overrides = engine.emptyTextOverrides();
  const put = (id, body = `正文-${id}。`) => { const variant = engine.editableVariantsForPackage(materialPackageId(id))[0]; assert.ok(variant); overrides.records[variant.slotKey] = engine.createOverrideRecord(variant, body); };
  for (const id of Object.keys(value.fragments)) put(id);
  const run = (messages = layers.map(layer => layer + '独立词').join(' '), settings = {}, options = {}) => engine.runEngine(typeof messages === 'string' ? [{ role: 'user', mes: messages }] : messages, settings, { textOverrides: overrides, ...options });
  return { engine, run, put };
}

test('all four term layers can emit unrestricted text without a place, including the living-area output path', () => {
  for (const canonical of [false, true]) {
    const f = fixture(library(), canonical), result = f.run(undefined, {}, canonical ? { directPlaceIds: [] } : {});
    for (const layer of layers) {
      assert.ok(result.prompt.includes(`正文-${layer}。`), layer);
      const item = f.engine.data.packages.find(row => row.id === materialPackageId(layer));
      assert.equal(item.matchMode, 'link_only'); assert.deepEqual(item.directTriggers, []);
      const evidence = result.diagnostics.injectedPackages.find(row => row.id === item.id);
      assert.equal(evidence.trigger, layer + '独立词'); assert.equal(evidence.source.source, 'current_user');
    }
    assert.deepEqual(result.diagnostics.materialPipeline.contexts, []);
    assert.equal(result.diagnostics.materialPipeline.keywordMatches.length, 4);
  }
});

test('keywords select the same category own text and direct cases, without default directory triggers or child recursion', () => {
  const raw = library(); raw.categories.child = { id: 'child', name: '无独立词孩子', layer: 'EX', parentId: 'EX' };
  raw.fragments.child = { id: 'child', title: '孩子情况', categoryId: 'child', regionId: '@any', conditions: {} };
  const own = materialOwnFragmentId('EX'); raw.fragments[own] = { id: own, regionId: '@any', conditions: {} };
  const f = fixture(raw), result = f.run('EX独立词');
  assert.ok(result.prompt.includes('正文-EX。')); assert.ok(result.prompt.includes(`正文-${own}。`));
  assert.ok(!result.prompt.includes('正文-child。')); assert.equal(f.run('EX目录名称 无独立词孩子').prompt, '');
});

test('independent EX/IN words still read current user input when only user location input is skipped', () => {
  const raw = library(); raw.places.shop = { id: 'shop', name: '独立词测试商店', climateRegionId: 'metro' };
  const f = fixture(raw), result = f.run('独立词测试商店 EX独立词 IN独立词', { skipUserLocationInput: true });
  assert.ok(result.prompt.includes('正文-EX。')); assert.ok(result.prompt.includes('正文-IN。'));
  assert.deepEqual(result.diagnostics.materialPipeline.contexts, []);
  assert.ok(result.diagnostics.materialPipeline.keywordMatches.every(row => row.source.source === 'current_user'));
});

test('keywords preserve user boundaries, assistant priority and exclusions, history depth and continue ordering', () => {
  const f = fixture();
  const messages = [{ role: 'assistant', mes: '<title>EX独立词</title><thinking>IN独立词</thinking> EV独立词' }, { role: 'user', mes: 'IN独立词<本轮用户输入>没有有效词</本轮用户输入>EV独立词' }];
  const result = f.run(messages);
  assert.ok(result.prompt.includes('正文-EX。')); assert.ok(!result.prompt.includes('正文-IN。')); assert.ok(!result.prompt.includes('正文-EV。'));
  const match = result.diagnostics.materialPipeline.keywordMatches.find(row => row.categoryId === 'EX');
  assert.equal(match.source.source, 'assistant_history'); assert.equal(match.source.historyIndex, 1); assert.ok(match.source.tagNames.includes('title'));
  assert.equal(f.run(messages, { historyDepth: 0 }).prompt, '');
  const continued = [...messages, { role: 'assistant', mes: '<title>IN独立词</title>' }];
  assert.ok(!f.run(continued).prompt.includes('正文-IN。'));
  assert.ok(f.run(continued, {}, { requestType: 'continue' }).prompt.includes('正文-IN。'));
});

test('TN resolves each registered term over its history while other channels stop at their nearest term-bearing entry', () => {
  const raw = library();
  for (const layer of ['TN', 'EX']) {
    raw.categories[layer + '2'] = { id: layer + '2', name: '第二词条', layer, activationKeywords: [layer + '另一词'] };
    raw.fragments[layer + '2'] = { id: layer + '2', title: '第二情况', categoryId: layer + '2', regionId: '@any', conditions: {} };
  }
  const f = fixture(raw), result = f.run([{ role: 'assistant', mes: '<title>TN另一词 EX另一词</title>' }, { role: 'user', mes: 'TN独立词 EX独立词' }]);
  for (const id of ['TN', 'TN2', 'EX']) assert.ok(result.prompt.includes(`正文-${id}。`));
  assert.ok(!result.prompt.includes('正文-EX2。'));
  const sameEntry = f.run('EX独立词 EX另一词');
  assert.ok(sameEntry.prompt.includes('正文-EX。')); assert.ok(sameEntry.prompt.includes('正文-EX2。'));
});

test('material terms ignore the place-only priority boundary and retain TN traffic-duration masking', () => {
  const raw = library(); raw.categories.TN.activationKeywords = ['30分钟']; raw.categories.EV.activationKeywords = ['30分钟'];
  const f = fixture(raw);
  const result = f.run([{ role: 'assistant', mes: '<title>EX独立词</title>' }, { role: 'assistant', mes: '<title>另一处尚未登记的地点</title>' }, { role: 'user', mes: '<!-- traffic info: 所需时间约30分钟 -->' }]);
  assert.ok(result.prompt.includes('正文-EX。')); assert.ok(result.prompt.includes('正文-EV。')); assert.ok(!result.prompt.includes('正文-TN。'));
  assert.equal(result.diagnostics.materialPipeline.keywordMatches.find(row => row.categoryId === 'EX').source.historyIndex, 2);
  assert.equal(f.run('EX独立词', { channelTags: { EX: { priority: ['other'], excluded: ['thinking'] } } }).diagnostics.materialPipeline.keywordMatches[0].source.source, 'current_user');
});

test('explicit region, conditions, empty bodies, family preference and all existing material switches still govern keyword output', () => {
  const raw = library();
  raw.fragments.EX.conditions = { months: [10], monthParts: [0], weatherTypes: ['light_rain'] };
  raw.fragments.IN.regionId = 'jp';
  raw.places.shop = { id: 'shop', name: '独立词测试商店', climateRegionId: 'metro', adminNodeId: 'fixture:nakano', adminPath: ['fixture:tokyo', 'fixture:nakano'],
    adminNodes: [{ id: 'fixture:tokyo', name: '东京都', kind: 'prefecture' }, { id: 'fixture:nakano', name: '中野区', kind: 'special_ward', parentId: 'fixture:tokyo' }] };
  for (const [id, regionId] of [['broad', '@any'], ['local', 'metro']]) raw.fragments[id] = { id, title: id, categoryId: 'EV', regionId, familyId: 'old-family', conditions: {} };
  raw.fragments.empty = { id: 'empty', title: '空文', categoryId: 'EV', regionId: '@any', conditions: {} };
  const f = fixture(raw); f.put('empty', '');
  const plain = f.run(); assert.ok(!plain.prompt.includes('正文-EX。')); assert.ok(!plain.prompt.includes('正文-IN。')); assert.ok(!plain.prompt.includes('正文-local。'));
  assert.ok(plain.diagnostics.materialPipeline.evaluated.some(row => row.id === 'IN' && row.reason === 'region_mismatch'));
  assert.ok(plain.diagnostics.materialPipeline.evaluated.some(row => row.id === 'empty' && row.reason === 'empty_body'));
  const text = '中野区 独立词测试商店 十月上旬 小雨 EX独立词 IN独立词 EV独立词';
  const valid = f.run(text); for (const id of ['EX', 'IN', 'local']) assert.ok(valid.prompt.includes(`正文-${id}。`));
  assert.ok(!valid.prompt.includes('正文-broad。'));
  const off = f.run(text, { packages: { [materialPackageId('local')]: false } });
  assert.ok(!off.prompt.includes('正文-local。')); assert.ok(!off.prompt.includes('正文-broad。'));
  for (const settings of [{ masterEnabled: false }, { layers: { EX: false } }, { groups: { [materialLayerGroupId('EX')]: false } }, { groups: { [materialGroupId('EX')]: false } }, { packages: { [materialPackageId('EX')]: false } }]) assert.ok(!f.run(text, settings).prompt.includes('正文-EX。'));
});

test('dual keyword and attachment entry emits once at its real owner; pausing the binding retains the independent route', () => {
  for (const enabled of [true, false]) {
    const raw = library(); raw.places.shop = { id: 'shop', name: '独立词测试商店', climateRegionId: 'metro' };
    raw.bindings.bind = { id: 'bind', entityId: 'shop', categoryId: 'EX', enabled };
    const f = fixture(raw, true), result = f.run('EX独立词', {}, { directPlaceIds: ['shop'] });
    assert.equal(result.prompt.split('正文-EX。').length - 1, 1);
    const placements = result.diagnostics.livingAreaExpansion.placedMaterials.filter(row => row.packageId === materialPackageId('EX'));
    assert.deepEqual(placements, enabled ? [{ packageId: materialPackageId('EX'), entityId: 'shop' }] : []);
    assert.ok(result.diagnostics.materialPipeline.evaluated.some(row => row.id === 'EX' && row.keyword));
    if (!enabled) assert.ok(result.diagnostics.materialPipeline.evaluated.some(row => row.id === 'EX' && row.blocker === 'binding_off'));
  }
});

test('a rejected independent region candidate does not become the source of text selected through its spatial parent', () => {
  const raw = library(); raw.fragments.EX.regionId = 'metro';
  raw.places.parent = { id: 'parent', name: '已确认地域的上级设施', climateRegionId: 'metro' };
  raw.bindings.bind = { id: 'bind', entityId: 'parent', categoryId: 'EX', enabled: true };
  const f = fixture(raw, {
    shop: { id: 'shop', name: '独立词测试商店', kind: 'poi', sourceIds: ['shop'], climateRegionId: null, related: [{ id: 'parent', kind: 'within' }] },
    parent: { id: 'parent', name: '已确认地域的上级设施', kind: 'facility', sourceIds: ['parent'], regionCode: '13', related: [{ id: 'shop', kind: 'contains' }] }
  });
  const result = f.run('EX独立词', {}, { directPlaceIds: ['shop'] });
  assert.ok(result.prompt.includes('正文-EX。'));
  const evidence = result.diagnostics.materialPipeline.evaluated.find(row => row.id === 'EX' && row.keyword);
  assert.equal(evidence.reason, 'region_mismatch'); assert.equal(evidence.source.source, 'current_user');
  const emitted = result.diagnostics.injectedPackages.find(row => row.id === materialPackageId('EX'));
  assert.equal(emitted.trigger, null); assert.equal(emitted.source, null);
  assert.deepEqual(result.diagnostics.livingAreaExpansion.placedMaterials, [{ packageId: materialPackageId('EX'), entityId: 'parent' }]);
});

test('term keyword editor saves a multiline optional list across reopening and clearing preserves bodies and bindings', async () => {
  let saved = null;
  const transport = { read: async () => structuredClone(saved), write: async value => { saved = structuredClone(value); } };
  const store = createUserStore({ transport }); await store.load();
  const session = createSession({ engine: createBaselineEngine(emptyMaterialRuntime()), store });
  const raw = library(); raw.places.shop = { id: 'shop', name: '独立词测试商店', climateRegionId: 'metro' }; raw.bindings.bind = { id: 'bind', entityId: 'shop', categoryId: 'EX', enabled: true };
  await session.runtime.saveMaterialLibrary(raw); await session.runtime.saveTextOverride(materialPackageId('EX'), null, '保存的正文。');
  const ui = { get engine() { return session.engine; }, bridge: { session, store }, refresh: async () => {}, notify() {}, reader: { leave: async () => true, refreshActive: async () => {} } };
  const editor = createMaterialEditor(ui);
  ui.ask = async spec => {
    assert.equal(spec.confirmDiscard, true); assert.equal(spec.fields[0].multiline, true);
    assert.match(spec.message, /本级正文/); return { id: 'save', values: { activationKeywords: ' 木造外观\n板墙\n木造外观\n  ' } };
  };
  await editor.editKeywords('EX');
  const reopened = createUserStore({ transport }); await reopened.load();
  assert.deepEqual(reopened.read().materialLibrary.categories.EX.activationKeywords, ['木造外观', '板墙']);
  assert.equal(Object.keys(reopened.read().materialLibrary.categories).length, 4);
  const recovered = reopened.read(), recoveredEngine = createBaselineEngine(emptyMaterialRuntime(), recovered);
  const recoveredRun = recoveredEngine.runEngine([{ role: 'user', mes: '板墙' }], recovered.livingJapanSettings, { textOverrides: recovered.livingJapanTextOverrides });
  assert.ok(recoveredRun.prompt.includes('保存的正文。'));
  assert.equal(recoveredRun.diagnostics.injectedPackages.find(row => row.id === materialPackageId('EX')).trigger, '板墙');
  ui.ask = async spec => { assert.equal(spec.fields[0].value, '木造外观\n板墙'); return { id: 'save', values: { activationKeywords: '' } }; };
  await editor.editKeywords('EX');
  assert.deepEqual(store.read().materialLibrary.categories.EX.activationKeywords, []);
  assert.deepEqual(store.read().materialLibrary.bindings, raw.bindings);
  assert.equal(store.read().livingJapanTextOverrides.records['P/' + materialPackageId('EX')].body, '保存的正文。');
});

test('keyword editor retains the exact input for retry after a save failure', async () => {
  const raw = library(), f = fixture(raw); let attempts = 0, dialogs = 0, saved = null;
  const draft = '木造外观\n板墙\n';
  const ui = { engine: f.engine, bridge: { store: { read: () => ({ materialLibrary: raw }) }, session: { runtime: { saveMaterialLibrary: async value => { if (++attempts === 1) throw new Error('保存冲突'); saved = value; } } } },
    refresh: async () => {}, notify() {}, reader: { leave: async () => true, refreshActive: async () => {} },
    ask: async spec => { if (++dialogs === 2) assert.equal(spec.fields[0].value, draft); return { id: 'save', values: { activationKeywords: draft } }; } };
  await createMaterialEditor(ui).editKeywords('EX');
  assert.equal(dialogs, 2); assert.deepEqual(saved.categories.EX.activationKeywords, ['木造外观', '板墙']);
});
