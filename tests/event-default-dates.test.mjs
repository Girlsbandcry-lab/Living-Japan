import test from 'node:test';
import assert from 'node:assert/strict';
import { createBaselineEngine } from '../src/baseline.js';
import { materialOwnFragmentId, materialPackageId } from '../src/material-library.js';
import { createSession } from '../src/session.js';
import { createUserStore } from '../src/storage.js';
import { createMaterialEditor } from '../ui/material-editor.js';
import { emptyMaterialRuntime } from './helpers/material-runtime.mjs';

const tanabata = 'ev.calendar.tanabata';
const newYear = 'ev.traditional.new-year';
const festival = 'ev.traditional.shrine-festival';

test('activity defaults gate real prompt output while preserving date precision', () => {
  const data = emptyMaterialRuntime(), admin = { id: 'event-test:city', name: '样本市', kind: 'city' };
  data.adminNodes = [admin];
  const raw = { categories: {
    [tanabata]: { name: '七夕', layer: 'EV', parentId: 'ev.calendar', activationKeywords: ['挂短册'] },
    [newYear]: { name: '年末年初行事', layer: 'EV', parentId: 'ev.traditional', activationKeywords: ['跨年参拜'] },
  }, places: { street: { name: '柳枝商店街', fullNames: ['柳枝商店街'], climateRegionId: 'metro', adminNodeId: admin.id } } };
  const engine = createBaselineEngine(data, { materialLibrary: raw });
  const overrides = engine.emptyTextOverrides();
  const texts = { [tanabata]: '彩纸在竹枝间晃动。', [newYear]: '参道上的灯照亮石阶。' };
  for (const [category, body] of Object.entries(texts)) {
    const variant = engine.editableVariantsForPackage(materialPackageId(materialOwnFragmentId(category)))[0];
    overrides.records[variant.slotKey] = engine.createOverrideRecord(variant, body);
  }
  const prompt = text => engine.runEngine([{ role: 'user', mes: '在样本市柳枝商店街。' + text }], engine.normalizeSettings({}), { textOverrides: overrides }).prompt;
  for (const date of ['7月上旬', '8月8日']) assert.ok(prompt(date + '，去挂短册。').includes(texts[tanabata]), date);
  for (const date of ['7月', '7月11日', '9月上旬']) assert.ok(!prompt(date + '，去挂短册。').includes(texts[tanabata]), date);
  for (const date of ['12月21日', '1月10日']) assert.ok(prompt(date + '，去跨年参拜。').includes(texts[newYear]), date);
  for (const date of ['12月20日', '1月11日', '12月下旬']) assert.ok(!prompt(date + '，去跨年参拜。').includes(texts[newYear]), date);
  assert.ok(!prompt('7月上旬走过商店街。').includes(texts[tanabata]));
});

test('personal conditions and existing fragments override defaults without changing unrelated categories', async () => {
  let saved = null;
  const transport = { read: async () => structuredClone(saved), write: async value => { saved = structuredClone(value); } };
  const engine = createBaselineEngine(emptyMaterialRuntime());
  const store = createUserStore({ transport }); await store.load();
  const session = createSession({ engine, store });
  const own = materialOwnFragmentId(tanabata);
  const personal = { fragments: {
    [own]: { regionId: '@any', conditions: {} },
    existing: { title: '商店街活动', categoryId: tanabata, regionId: 'jp', conditions: { months: [9] } },
  } };
  await session.runtime.saveMaterialLibrary(personal);
  const reopened = createUserStore({ transport }); await reopened.load();
  const library = createSession({ engine, store: reopened }).engine.data.materialLibrary;
  assert.deepEqual(library.fragments[own].conditions, {});
  assert.equal(library.fragments[own].regionId, '@any');
  assert.deepEqual(library.fragments.existing.conditions, { months: [9] });
  assert.deepEqual(library.fragments[materialOwnFragmentId(festival)].conditions, {});
  assert.deepEqual(library.fragments[materialOwnFragmentId(newYear)].conditions, { startDate: '12-21', endDate: '01-10' });
});

test('new activity fragments start with the same defaults as their own body', async () => {
  const engine = createBaselineEngine(emptyMaterialRuntime());
  let written;
  const ui = {
    engine,
    bridge: { store: { read: () => ({}) }, session: { runtime: { saveMaterialLibrary: async value => { written = value; } } } },
    ask: async spec => spec.fields ? { id: 'save', values: { title: '商店街短册', regionId: 'jp' } } : 'fragment',
    refresh: async () => {}, locateMaterial: async () => {}, getEntityForPackage: () => ({}), notify() {},
  };
  await createMaterialEditor(ui).add({ categoryId: tanabata, kind: 'material-category', name: '七夕', layer: 'EV' });
  const fragment = Object.values(written.fragments)[0];
  assert.deepEqual(fragment.conditions, { months: [7, 8], monthParts: [0] });
  fragment.conditions.months.push(9);
  assert.deepEqual(engine.data.materialLibrary.fragments[materialOwnFragmentId(tanabata)].conditions, { months: [7, 8], monthParts: [0] });
});
