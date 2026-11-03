import test from 'node:test';
import assert from 'node:assert/strict';
import { createBaselineEngine } from '../src/baseline.js';
import { createSession } from '../src/session.js';
import { createUserStore } from '../src/storage.js';
import { materialOwnFragmentId, materialPackageId, materialCategoryNodeId, materialRegionGroupId } from '../src/material-library.js';
import { buildMaterialsModel } from '../ui/materials.js';
import { createMaterialEditor, fragmentConditionText } from '../ui/material-editor.js';
import { emptyMaterialRuntime } from './helpers/material-runtime.mjs';

const ANY = '@any';
const admin = { id: 'universal-test:city', name: '样本市', kind: 'city' };
function library(region = null) {
  return { categories: { wood: { id: 'wood', name: '木造外观', layer: 'EX', parentId: null }, tree: { id: 'tree', name: '树木形态', layer: 'TN', parentId: null } }, regions: {},
    places: { point: { id: 'point', name: '通用取用测试庭院', fullNames: ['通用取用测试庭院'], climateRegionId: region, adminNodeId: admin.id } },
    bindings: { wood: { id: 'wood', entityId: 'point', categoryId: 'wood', enabled: true }, tree: { id: 'tree', entityId: 'point', categoryId: 'tree', enabled: true } },
    fragments: { wood: { id: 'wood', title: '木造通用底文', categoryId: 'wood', regionId: ANY, conditions: {} }, jp: { id: 'jp', title: '原全国片段', categoryId: 'wood', regionId: 'jp', conditions: {} } } };
}
function fixture(value = library()) {
  const data = emptyMaterialRuntime();
  data.adminNodes = [admin];
  const engine = createBaselineEngine(data, { materialLibrary: value }), overrides = engine.emptyTextOverrides();
  const put = (id, body = `正文：${id}。`) => { const variant = engine.editableVariantsForPackage(materialPackageId(id))[0]; assert.ok(variant); overrides.records[variant.slotKey] = engine.createOverrideRecord(variant, body); };
  const run = (text = '通用取用测试庭院', settings = {}) => engine.runEngine([{ role: 'user', mes: text.replace('通用取用测试庭院', '样本市通用取用测试庭院') }], engine.normalizeSettings(settings), { textOverrides: overrides });
  return { engine, put, run };
}

test('unrestricted TN text has its own navigable body and controls without becoming a geographic region', () => {
  const { engine } = fixture(), data = engine.data, model = buildMaterialsModel(engine);
  assert.equal(data.materialLibrary.regions[ANY], undefined);
  const any = materialOwnFragmentId('tree', ANY), nationwide = materialOwnFragmentId('tree', 'jp');
  assert.notEqual(any, nationwide);
  assert.equal(data.materialLibrary.fragments[nationwide].regionId, 'jp');
  const node = model.nodes.get(materialCategoryNodeId('tree', ANY));
  assert.equal(node.packageId, materialPackageId(any));
  assert.deepEqual(model.path(node.id).map(row => row.name).slice(-2), ['不限地域', '树木形态']);
  assert.ok(data.packages.find(row => row.id === node.packageId).controlGroupIds.includes(materialRegionGroupId(ANY)));
  const invalid = library(); invalid.places.point.climateRegionId = ANY;
  assert.throws(() => createBaselineEngine(emptyMaterialRuntime(), { materialLibrary: invalid }), /地域不存在/);
});

test('attached universal text works across unknown and known regions without date or weather requirements, but still needs an entry', () => {
  for (const region of [null, 'metro', 'hokkaido', 'okinawa']) {
    const f = fixture(library(region)); f.put('wood'); f.put('jp');
    for (const text of ['通用取用测试庭院', '十月上旬 小雨 通用取用测试庭院', '1月21日 23:30 降雪 通用取用测试庭院']) {
      const result = f.run(text);
      assert.ok(result.prompt.includes('正文：wood。'));
      assert.equal(result.prompt.includes('正文：jp。'), region !== null);
      assert.equal(result.diagnostics.materialPipeline.evaluated.find(row => row.id === 'wood').universal, true);
    }
    assert.ok(!f.run('没有提到登记地点').prompt.includes('正文：wood。'));
  }
  const raw = library(); raw.bindings = {};
  const unbound = fixture(raw); unbound.put('wood');
  assert.ok(!unbound.run().prompt.includes('正文：wood。'));
});

test('unrestricted regional own text keeps its existing candidate rules and package or regional branch switches', () => {
  const f = fixture(), own = materialOwnFragmentId('tree', ANY); f.put(own, '不限地域的树木本级正文。');
  assert.ok(f.run().prompt.includes('不限地域的树木本级正文'));
  assert.ok(!f.run(undefined, { packages: { [materialPackageId(own)]: false } }).prompt.includes('不限地域的树木本级正文'));
  assert.ok(!f.run(undefined, { groups: { [materialRegionGroupId(ANY)]: false } }).prompt.includes('不限地域的树木本级正文'));
  const raw = library(); raw.bindings.tree.enabled = false;
  const paused = fixture(raw); paused.put(own, '不限地域的树木本级正文。');
  assert.ok(!paused.run().prompt.includes('不限地域的树木本级正文'));
});

test('universal and conditional independent fragments coexist while existing regional families still choose before switches', () => {
  const raw = library('metro');
  raw.fragments.wet = { id: 'wet', title: '上旬雨天木造', categoryId: 'wood', regionId: ANY, conditions: { months: [10], monthParts: [0], weatherTypes: ['light_rain'] } };
  for (const [id, regionId] of [['broad', ANY], ['national', 'jp'], ['local', 'metro']]) raw.fragments[id] = { id, title: id, categoryId: 'wood', regionId, familyId: 'preserved-family', conditions: {} };
  const f = fixture(raw); for (const id of Object.keys(raw.fragments)) f.put(id);
  const wet = f.run('十月上旬 小雨 通用取用测试庭院');
  for (const id of ['wood', 'wet', 'local']) assert.ok(wet.prompt.includes(`正文：${id}。`));
  for (const id of ['broad', 'national']) assert.ok(!wet.prompt.includes(`正文：${id}。`));
  assert.ok(!f.run('十月中旬 小雨 通用取用测试庭院').prompt.includes('正文：wet。'));
  const off = f.run(undefined, { packages: { [materialPackageId('local')]: false } });
  for (const id of ['local', 'national', 'broad']) assert.ok(!off.prompt.includes(`正文：${id}。`));
});

async function editorFixture(value) {
  let saved = null;
  const transport = { read: async () => structuredClone(saved), write: async next => { saved = structuredClone(next); } };
  const engine = createBaselineEngine(emptyMaterialRuntime()), store = createUserStore({ transport }); await store.load();
  const session = createSession({ engine, store }); await session.runtime.saveMaterialLibrary(value);
  const opened = [], notices = [];
  const ui = { get engine() { return session.engine; }, bridge: { session, store }, reader: { leave: async () => true, refreshActive: async () => {} }, refresh: async () => {}, notify: message => notices.push(message),
    getEntityForPackage: id => ({ id, packageIds: [id] }), locateMaterial: async (_entity, id) => opened.push(id) };
  const answer = (spec, values = {}, id = 'save') => ({ id, values: { ...Object.fromEntries(spec.fields.map(field => [field.id, field.value])), ...values } });
  return { ui, store, session, transport, engine, opened, notices, answer, editor: createMaterialEditor(ui) };
}

test('saving universal applicability preserves body identity and the old family, and reopening retains the new explicit scope', async () => {
  const raw = library('metro'); raw.fragments.wood.regionId = 'jp'; raw.fragments.wood.familyId = 'old-family'; raw.fragments.wood.conditions = { months: [10], monthParts: [0], startTime: '22:00', endTime: '02:00', weatherTypes: ['light_rain'] };
  const f = await editorFixture(raw), id = materialPackageId('wood');
  await f.session.runtime.saveTextOverride(id, null, '保留同一正文稿。');
  f.ui.ask = async spec => {
    assert.ok(!spec.fields.some(field => field.id === 'familyId'));
    assert.equal(spec.fields.find(field => field.id === 'applicability').value, 'conditional');
    return f.answer(spec, { applicability: 'universal' });
  };
  await f.editor.editFragment('wood');
  const reopened = createUserStore({ transport: f.transport }); await reopened.load();
  const result = reopened.read().materialLibrary.fragments.wood;
  assert.equal(result.id, 'wood'); assert.equal(result.regionId, ANY); assert.equal(result.familyId, 'old-family'); assert.deepEqual(result.conditions, {});
  assert.equal(reopened.read().livingJapanTextOverrides.records['P/' + id].body, '保留同一正文稿。');
  assert.equal(fragmentConditionText(f.session.engine.data.materialLibrary, result), '通用 · 不限地区、日期、时段和天气');
  f.ui.ask = async spec => { assert.equal(spec.fields.find(field => field.id === 'applicability').value, 'universal'); return f.answer(spec, {}, 'cancel'); };
  await f.editor.editFragment('wood');
});

test('fixed TN national or regional own text cannot silently move into the unrestricted slot', async () => {
  const raw = library('metro'), id = materialOwnFragmentId('tree', 'jp');
  raw.fragments[id] = { id, conditions: { months: [10] } };
  const f = await editorFixture(raw), before = f.store.read();
  f.ui.ask = async spec => {
    assert.ok(!spec.fields.some(field => ['applicability', 'regionId', 'familyId'].includes(field.id)));
    assert.ok(spec.choices.some(choice => choice.id === 'unrestricted'));
    assert.equal(spec.confirmDiscard, true);
    assert.ok(spec.discardChoices.includes('unrestricted'));
    return f.answer(spec, { months: '11' }, 'unrestricted');
  };
  await f.editor.editFragment(id);
  assert.deepEqual(f.store.read(), before);
  assert.deepEqual(f.opened, [materialPackageId(materialOwnFragmentId('tree', ANY))]);
});

test('applicability keeps unrestricted conditional dates distinct and place geography never offers unrestricted', async () => {
  const f = await editorFixture(library());
  f.ui.ask = async spec => {
    const region = spec.fields.find(field => field.id === 'regionId');
    assert.ok(region.options.some(option => option.value === ANY));
    assert.ok(region.options.some(option => option.value === 'jp'));
    assert.equal(spec.fields.find(field => field.id === 'monthParts').visibleWhen.id, 'applicability');
    return f.answer(spec, { applicability: 'conditional', regionId: ANY, months: '3、4', monthParts: ['0'] });
  };
  await f.editor.editFragment('wood');
  const result = f.store.read().materialLibrary.fragments.wood;
  assert.equal(result.regionId, ANY); assert.deepEqual(result.conditions.monthParts, [0]);
  assert.match(fragmentConditionText(f.ui.engine.data.materialLibrary, result), /不限地域.*3、4月.*上旬/);
  f.ui.ask = async spec => { assert.ok(!spec.fields.find(field => field.id === 'climateRegionId').options.some(option => option.value === ANY)); return f.answer(spec, {}, 'close'); };
  await f.editor.showPlace({ id: 'point', name: '通用取用测试庭院' });
});
