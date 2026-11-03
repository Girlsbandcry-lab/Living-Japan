import test from 'node:test';
import assert from 'node:assert/strict';
import { createBaselineEngine } from '../src/baseline.js';
import { createSession } from '../src/session.js';
import { createUserStore } from '../src/storage.js';
import { materialPackageId } from '../src/material-library.js';
import { createMaterialEditor, fragmentConditionText } from '../ui/material-editor.js';
import * as diagnosticUI from '../ui/diagnostics.js';
import { emptyMaterialRuntime } from './helpers/material-runtime.mjs';

function calendarRuntime() {
  const data = emptyMaterialRuntime();
  data.packages.push({ id: 'calendar', order: 1, layer: 'TN', displayName: '每旬旧资料', matchMode: 'direct', directTriggers: [], activation: { kind: 'calendar_variant', calendarBodyKey: 'season' }, body: '', links: [] });
  data.defaultSettings.packages.calendar = true;
  for (const month of [10, 11]) for (const [part, start, end] of [['上旬', 1, 10], ['中旬', 11, 20], ['下旬', 21, null]]) {
    const id = `${month}-${start}`;
    data.calendarSegments.push({ id, label: `${month}月${part}`, month, dayStart: start, dayEnd: end, calendarBodies: { season: `旧表正文：${month}月${part}。` } });
    data.editableTextSlots.slots[`V/${id}/calendar`] = { packageId: 'calendar', calendarSegmentId: id, bodySha256: id };
  }
  return data;
}
const admin = { id: 'monthpart-test:city', name: '样本市', kind: 'city' };
function library() {
  return { schemaVersion: 1, categories: { tree: { id: 'tree', name: '树木资料', parentId: null, layer: 'EX' } }, regions: {},
    places: { park: { id: 'park', name: '旬条件测试公园', fullNames: ['旬条件测试公园'], climateRegionId: 'metro', adminNodeId: admin.id } },
    bindings: { tree: { id: 'tree', entityId: 'park', categoryId: 'tree', enabled: true } },
    fragments: Object.fromEntries([0, 1, 2].map(part => [`part${part}`, { id: `part${part}`, title: ['上旬树木', '中旬树木', '下旬树木'][part], categoryId: 'tree', regionId: 'metro', conditions: { months: [10, 11], monthParts: [part] } }])) };
}
function fixture(materialLibrary = library()) {
  const data = calendarRuntime();
  data.adminNodes = [admin];
  const engine = createBaselineEngine(data, { materialLibrary }), overrides = engine.emptyTextOverrides();
  for (const id of Object.keys(materialLibrary.fragments)) {
    const variant = engine.editableVariantsForPackage(materialPackageId(id))[0];
    overrides.records[variant.slotKey] = engine.createOverrideRecord(variant, `新片段正文：${id}。`);
  }
  const run = (value, settings = {}) => engine.runEngine(Array.isArray(value) ? value : [{ role: 'user', mes: `${value}。样本市旬条件测试公园` }], engine.normalizeSettings(settings), { textOverrides: overrides });
  return { engine, run };
}

test('date parsing preserves explicit part precision and its complete source without inventing a day', () => {
  const engine = createBaselineEngine(emptyMaterialRuntime());
  for (const [input, raw, month, part] of [['现在十月上旬', '十月上旬', 10, 0], ['现在10月中旬', '10月中旬', 10, 1], ['十一月下旬', '十一月下旬', 11, 2], ['十月初', '十月初', 10, 0], ['十月末', '十月末', 10, 2]]) {
    const date = engine.parseDateState(input);
    assert.deepEqual([date.month, date.day, date.monthPart, date.precision, date.raw], [month, null, part, 'month_part', raw]);
    assert.equal(engine.normalizeText(input).slice(date.index, date.end), raw);
  }
  const month = engine.parseDateState('十月');
  assert.deepEqual([month.day, month.monthPart, month.precision], [null, null, 'month']);
  assert.equal(engine.parseDateState('10月20日。上旬另有安排').monthPart, 1, 'an unrelated later word cannot override the concrete date');
  assert.equal(engine.parseDateState('10月20日。11月上旬').month, 11);
});

test('the old calendar selects explicit parts and exact day boundaries while month-only retains its old middle fallback', () => {
  const { run } = fixture();
  for (const [input, expected, segment] of [['十月上旬', '10月上旬', '10-1'], ['十月中旬', '10月中旬', '10-11'], ['十月下旬', '10月下旬', '10-21'], ['10月10日', '10月上旬', '10-1'], ['10月11日', '10月中旬', '10-11'], ['10月20日', '10月中旬', '10-11'], ['10月21日', '10月下旬', '10-21'], ['11月上旬', '11月上旬', '11-1'], ['十月', '10月中旬', '10-11']]) {
    const result = run(input);
    assert.ok(result.prompt.includes(`旧表正文：${expected}。`), input);
    assert.equal(result.diagnostics.calendarSelection.segmentId, segment);
    assert.equal(result.diagnostics.calendarSelection.monthOnlyFallback, input === '十月');
  }
});

test('new part conditions follow explicit parts or real days, never the old calendar month-only fallback', () => {
  const { run } = fixture();
  for (const [input, expected] of [['十月上旬', ['part0']], ['十月中旬', ['part1']], ['十月下旬', ['part2']], ['10月10日', ['part0']], ['10月11日', ['part1']], ['10月20日', ['part1']], ['10月21日', ['part2']], ['11月上旬', ['part0']], ['十月', []], ['十二月上旬', []], ['', []]]) {
    const result = run(input);
    assert.deepEqual(result.packages.filter(p => p.materialFragmentId).map(p => p.materialFragmentId), expected, input);
    if (input === '十月') assert.ok(result.diagnostics.materialPipeline.evaluated.filter(row => row.id.startsWith('part')).every(row => !row.conditionsMatched));
  }
});

test('part conditions combine with the actual weather and keep exact date conditions exact', () => {
  const value = library();
  value.fragments.part0.conditions.weatherTypes = ['light_rain'];
  value.fragments.part1.conditions = { monthParts: [1], startDate: '10-11', endDate: '10-20' };
  const { run } = fixture(value);
  assert.ok(run('十月上旬 小雨').prompt.includes('新片段正文：part0'));
  assert.ok(!run('十月上旬 晴朗').prompt.includes('新片段正文：part0'));
  assert.ok(!run('十月中旬').prompt.includes('新片段正文：part1'));
  assert.ok(run('10月11日').prompt.includes('新片段正文：part1'));
});

test('a current part replaces an older exact date while independent clock and weather sources survive TN output being paused', () => {
  const { run } = fixture();
  const result = run([{ role: 'assistant', mes: '<time_format>10月21日 18:30 小雨</time_format>' }, { role: 'user', mes: '现在十月上旬，样本市旬条件测试公园。' }], { layers: { TN: false } });
  const state = result.diagnostics.restoredStoryState, sources = result.diagnostics.channels.TN.stateSources;
  assert.deepEqual([state.date.day, state.date.monthPart, state.date.raw], [null, 0, '十月上旬']);
  assert.equal(sources.date.source, 'current_user');
  assert.equal(sources.clockEndpoint.source, 'assistant_history');
  assert.equal(sources.weather.source, 'assistant_history');
  assert.ok(result.prompt.includes('新片段正文：part0'));
  assert.ok(!result.prompt.includes('旧表正文'));
});

test('material validation rejects invalid part values before saving', () => {
  for (const invalid of [[3], [-1], [0.5], ['0'], '上旬']) {
    const value = library(); value.fragments.part0.conditions.monthParts = invalid;
    assert.throws(() => createBaselineEngine(emptyMaterialRuntime(), { materialLibrary: value }), /旬/);
  }
});

test('condition editor persists selected parts through real session storage and reopening without losing other conditions', async () => {
  let saved = null;
  const transport = { read: async () => structuredClone(saved), write: async value => { saved = structuredClone(value); } };
  const engine = createBaselineEngine(calendarRuntime()), store = createUserStore({ transport });
  await store.load();
  const session = createSession({ engine, store });
  const value = library(); value.fragments.part0.conditions = { months: [10], startTime: '22:00', endTime: '02:00', weatherTypes: ['light_rain'] };
  await session.runtime.saveMaterialLibrary(value);
  const notices = [];
  const ui = { get engine() { return session.engine; }, bridge: { store, session }, reader: { leave: async () => true, refreshActive: async () => {} }, refresh: async () => {}, notify: message => notices.push(message),
    ask: async spec => {
      assert.ok(spec.fields.some(field => field.id === 'monthParts'), 'the editor must expose the three parts');
      return { id: 'save', values: { ...Object.fromEntries(spec.fields.map(field => [field.id, field.value])), monthParts: ['0', '2'] } };
    } };
  await createMaterialEditor(ui).editFragment('part0');
  const reopened = createUserStore({ transport }); await reopened.load();
  const conditions = reopened.read().materialLibrary.fragments.part0.conditions;
  assert.deepEqual(conditions.monthParts, [0, 2]);
  assert.equal(conditions.startTime, '22:00'); assert.equal(conditions.endTime, '02:00'); assert.deepEqual(conditions.weatherTypes, ['light_rain']);
  const nextSession = createSession({ engine, store: reopened });
  ui.bridge = { store: reopened, session: nextSession };
  Object.defineProperty(ui, 'engine', { get: () => nextSession.engine });
  ui.ask = async spec => { assert.deepEqual(spec.fields.find(field => field.id === 'monthParts').value, ['0', '2']); return { id: 'cancel' }; };
  await createMaterialEditor(ui).editFragment('part0');
  assert.match(fragmentConditionText(nextSession.engine.data.materialLibrary, nextSession.engine.data.materialLibrary.fragments.part0), /上旬、下旬/);
  assert.equal(notices.length, 1);
});

test('diagnostic date text distinguishes explicit parts and the legacy month-only lookup with their reading source', () => {
  assert.equal(typeof diagnosticUI.storyDateDiagnosticText, 'function');
  const { run } = fixture();
  const explicit = diagnosticUI.storyDateDiagnosticText(run('十月上旬').diagnostics);
  assert.match(explicit, /十月上旬/); assert.match(explicit, /未指定具体日/); assert.match(explicit, /本轮用户输入/); assert.match(explicit, /10月上旬/);
  const monthOnly = diagnosticUI.storyDateDiagnosticText(run('十月').diagnostics);
  assert.match(monthOnly, /仅月份/); assert.match(monthOnly, /原有15日/); assert.match(monthOnly, /10月中旬/);
});
