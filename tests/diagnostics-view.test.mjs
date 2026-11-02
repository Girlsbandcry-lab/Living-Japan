import test from 'node:test';
import assert from 'node:assert/strict';
import { mountDiagnostics } from '../ui/diagnostics.js';

function fixture(layout = 'desktop') {
  const previous = globalThis.document, nodes = new Map(), notices = [], copied = [];
  const makeNode = (id = '') => {
    const selectors = new Map(), handlers = {}, classes = new Set(); let html = '';
    const node = { id, handlers, hidden: false, textContent: '', value: '', dataset: {},
      classList: { add: (...values) => values.forEach(value => classes.add(value)), toggle: (name, on) => on ? classes.add(name) : classes.delete(name), contains: name => classes.has(name) },
      addEventListener: (name, fn) => { handlers[name] = fn; }, setAttribute() {},
      querySelector: selector => selectors.get(selector) || null, querySelectorAll: () => [],
      closest: () => nodes.get('page'), focus() {}, matches: selector => selector === '[data-lj-diag-query]',
    };
    Object.defineProperty(node, 'innerHTML', { get: () => html, set(value) {
      html = value; selectors.clear();
      for (const match of value.matchAll(/\bid="([^"]+)"/g)) if (!nodes.has(match[1])) nodes.set(match[1], makeNode(match[1]));
      if (value.includes('data-lj-diag-query')) selectors.set('[data-lj-diag-query]', { value: '', matches: selector => selector === '[data-lj-diag-query]', focus() {} });
      if (value.includes('data-lj-diag-list')) selectors.set('[data-lj-diag-list]', { innerHTML: value });
      if (value.includes('data-lj-diag-visible')) selectors.set('[data-lj-diag-visible]', { textContent: '' });
      if (value.includes('data-lj-diag-clear')) selectors.set('[data-lj-diag-clear]', { hidden: true });
    } });
    return node;
  };
  const page = makeNode('page'); nodes.set('page', page);
  for (const id of ['check11Records', 'check11Summary', 'check11Tabs', 'check11Content', 'diagRecords', 'diagSummary', 'diagTabs', 'diagResults', 'diagReport', 'diagFilter', 'diagCopy']) nodes.set(id, makeNode(id));
  nodes.set('ljDiagnosticsPage', page);
  const records = { actual: { status: 'expanded', prompt: '完整提示词\n含换行', diagnostics: { injectedPackages: [
    { id: 'tokyo', trigger: '东京', reason: 'direct', customText: true, source: { source: 'assistant_history', historyIndex: 2 } },
    { id: 'kanagawa', trigger: '横滨', reason: 'linked' },
  ], blockedPackages: [{ id: 'saitama', blocker: 'package_off', source: { source: 'current_user' } }] } }, preview: { status: 'preview', prompt: '新的预览', diagnostics: { injectedPackages: [{ id: 'kanagawa' }] } } };
  const settings = { diagnostics: true, channelTags: Object.fromEntries(['TN', 'EX', 'IN', 'EV'].map(key => [key, { priority: [], excluded: [] }])) };
  const ui = { layout, esc: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
    engine: { normalizeSettings: value => value, data: { controlGroups: [], packages: [ ['tokyo', '东京'], ['kanagawa', '神奈川'], ['saitama', '埼玉'] ].map(([id, displayName]) => ({ id, displayName, layer: 'EX' })) } },
    bridge: { store: { read: () => ({ livingJapanSettings: settings }) }, session: { runtime: { getLastActualInjection: () => records.actual, getLastPreview: () => records.preview }, preview: async () => {} }, catalog: {} },
    notify: (...args) => notices.push(args), openSettings() {},
  };
  globalThis.document = { getElementById: id => nodes.get(id), querySelector: selector => selector === '[data-page-root="diagnostic"]' ? page : null, querySelectorAll: () => [] };
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => copied.push(text) } } });
  const view = mountDiagnostics(ui), main = nodes.get(layout === 'desktop' ? 'check11Content' : 'diagResults');
  return { view, nodes, main, records, settings, copied, notices,
    click: dataset => page.handlers.click({ target: { closest: () => ({ dataset }) } }),
    restore() { globalThis.document = previous; if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else delete globalThis.navigator; },
  };
}

test('diagnostic results expose truthful reading positions, reasons and visible totals', () => {
  const f = fixture();
  try {
    assert.match(f.main.innerHTML, /资料名称.*结果.*读取位置.*命中与处理原因/s);
    assert.match(f.main.innerHTML, /向上第 2 层 AI 回复/);
    assert.match(f.main.innerHTML, /本轮用户输入/);
    assert.match(f.main.innerHTML, /未记录读取位置/);
    assert.match(f.main.innerHTML, /使用修改稿/);
    assert.match(f.main.innerHTML, /显示 3 \/ 3 条/);
  } finally { f.restore(); }
});

test('material draft diagnostics show the existing saved-draft label and a readable selection reason', () => {
  const f = fixture();
  try {
    f.records.actual.diagnostics.injectedPackages[0].reason = 'material_fragment';
    f.view.render();
    const html = f.main.querySelector('[data-lj-diag-list]').innerHTML;
    assert.match(html, /使用修改稿/);
    assert.match(html, /按地点及适用条件选入/);
    assert.doesNotMatch(html, /material_fragment/);
  } finally { f.restore(); }
});

test('diagnostic search can find displayed source and reason without replacing the input', () => {
  const f = fixture();
  try {
    const input = f.main.querySelector('[data-lj-diag-query]');
    input.value = '本级正文已关闭'; f.main.handlers.input({ target: input });
    assert.equal(f.main.querySelector('[data-lj-diag-query]'), input);
    assert.match(f.main.querySelector('[data-lj-diag-list]').innerHTML, /埼玉/);
    assert.doesNotMatch(f.main.querySelector('[data-lj-diag-list]').innerHTML, /东京/);
    input.value = '第 2 层'; f.main.handlers.input({ target: input });
    assert.match(f.main.querySelector('[data-lj-diag-list]').innerHTML, /东京/);
    assert.doesNotMatch(f.main.querySelector('[data-lj-diag-list]').innerHTML, /神奈川/);
  } finally { f.restore(); }
});

test('prompt and JSON reading views identify their record and copy exactly their own text', async () => {
  const f = fixture();
  try {
    await f.click({ ljDiagTab: 'prompt' });
    assert.match(f.main.innerHTML, /实际提示词全文/);
    assert.match(f.main.innerHTML, new RegExp(`${f.records.actual.prompt.length} 字符`));
    await f.click({ ljDiagAction: 'copy-page' });
    assert.equal(f.copied.at(-1), f.records.actual.prompt);
    await f.click({ ljDiagTab: 'raw' });
    await f.click({ ljDiagAction: 'copy-page' });
    assert.deepEqual(JSON.parse(f.copied.at(-1)), f.records.actual);
    await f.click({ ljDiagRecord: 'preview' });
    await f.click({ ljDiagTab: 'prompt' });
    assert.match(f.main.innerHTML, /预览提示词全文/);
    await f.click({ ljDiagAction: 'copy-page' });
    assert.equal(f.copied.at(-1), f.records.preview.prompt);
  } finally { f.restore(); }
});

for (const layout of ['portrait', 'mobile']) test(`${layout} separates record status from statistics and retains its search across tabs`, async () => {
  const f = fixture(layout);
  try {
    assert.match(f.nodes.get('diagScope')?.textContent || '', /本轮宏已展开；不代表模型已接收/);
    assert.doesNotMatch(f.nodes.get('diagSummary').innerHTML, /不代表模型已接收/);
    const find = f.nodes.get('diagFind'), input = find.querySelector('[data-lj-diag-query]');
    input.value = '东京'; find.handlers.input({ target: input });
    await f.click({ ljDiagTab: 'prompt' }); assert.equal(find.hidden, true);
    await f.click({ ljDiagTab: 'results' }); assert.equal(find.hidden, false);
    assert.equal(find.querySelector('[data-lj-diag-query]'), input);
    assert.equal(input.value, '东京');
    if (layout === 'mobile') assert.equal(f.nodes.get('page').classList.contains('mobile-diagnostic'), true);
  } finally { f.restore(); }
});
