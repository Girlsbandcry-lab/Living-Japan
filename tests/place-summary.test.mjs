import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaceSummary } from '../ui/place-summary.js';

const body = '很长的正文。'.repeat(100);
const summary = createPlaceSummary({
  engine: { data: { packages: [{ id: 'body', body }] }, resolveEffectiveBody: item => ({ body: item.body }) },
  reader: { packageIds: entity => entity.packageIds || [] },
  bridge: { store: { read: () => ({ livingJapanTextOverrides: {} }) } },
});

test('selected and related cards show type with the independent introduction while separately reporting available detail', () => {
  const text = '建在商场屋顶的公园，有草坪、攀岩墙和滑板场，下面是商店和横丁';
  assert.deepEqual(summary({ id: 'known', type: '公园', summary: text, packageIds: ['body'] }), { text: '公园 · ' + text, hasBody: true });
  assert.deepEqual(summary({ id: 'empty-body', type: '公园', summary: text }), { text: '公园 · ' + text, hasBody: false });
});

test('cards without an introduction show only type and never borrow detail or address', () => {
  const entity = { id: 'unmapped', name: '未映射地点', type: '咖啡馆', address: '东京都台东区 1-2', adminNodes: [{ label: '东京都' }] };
  assert.deepEqual(summary(entity), { text: '咖啡馆', hasBody: false });
  assert.deepEqual(summary({ ...entity, packageIds: ['body'] }), { text: '咖啡馆', hasBody: true });
  assert.deepEqual(summary({ id: 'unknown-type' }), { text: '地点', hasBody: false });
  assert.deepEqual(summary(null), { text: '在地图或搜索结果中选择地点', hasBody: false });
});

test('saved detail never replaces the independent source introduction', () => {
  const saved = '用户保存的地点正文。';
  const data = { packages: [{ id: 'body', body }], materialLibrary: { places: { cleared: { summary: '' } } } };
  const read = createPlaceSummary({
    engine: { data, resolveEffectiveBody: (item, segment, overrides) => ({ body: overrides.saved }) },
    reader: { packageIds: () => ['body'] },
    bridge: { store: { read: () => ({ livingJapanTextOverrides: { saved } }) } },
  });
  assert.deepEqual(read({ id: 'known', type: '公园', summary: '已有来源简介。' }), { text: '公园 · 已有来源简介。', hasBody: true });
  assert.deepEqual(read({ id: 'cleared', type: '公园', summary: '已有来源简介。' }), { text: '公园', hasBody: true });
});

test('selected map headings show only their independent introduction and keep the original return shape', () => {
  const entity = { id: 'known', type: '公园', summary: '池塘周围是草地。', packageIds: ['body'] };
  assert.deepEqual(summary(entity, { selected: true }), { text: '池塘周围是草地。', hasBody: true });
  assert.deepEqual(summary({ type: '咖啡馆' }, { selected: true }), { text: '', hasBody: false });
  assert.deepEqual(summary(entity), { text: '公园 · 池塘周围是草地。', hasBody: true });
  assert.deepEqual(summary(null, { selected: true }), { text: '在地图或搜索结果中选择地点', hasBody: false });
});
