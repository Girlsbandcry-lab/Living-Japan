import test from 'node:test';
import assert from 'node:assert/strict';
import { mountDiagnostics } from '../ui/diagnostics.js';
import { mountSettings } from '../ui/settings.js';

function node() {
  const handlers = {};
  return { handlers, innerHTML: '', textContent: '', hidden: false, classList: { add() {}, toggle() {} }, addEventListener: (name, fn) => { handlers[name] = fn; }, querySelector: () => null, querySelectorAll: () => [], closest: () => null, contains: () => false };
}
function diagnosticFixture() {
  const previous = globalThis.document, nodes = new Map(['check11Records', 'check11Summary', 'check11Tabs', 'check11Content', 'ljDiagnosticsPage'].map(id => [id, node()]));
  const main = nodes.get('check11Content'); let html = '', input, list;
  Object.defineProperty(main, 'innerHTML', { get: () => html, set(value) {
    html = value;
    input = value.includes('data-lj-diag-query') ? { value: '', selectionStart: 0, matches: selector => selector === '[data-lj-diag-query]', focus() {}, setSelectionRange() {} } : null;
    list = value.includes('data-lj-diag-list') ? { innerHTML: value } : null;
  } });
  main.querySelector = selector => selector === '[data-lj-diag-query]' ? input : selector === '[data-lj-diag-list]' ? list : null;
  const dispatched = [], calls = [], record = { status: 'expanded', packageIds: ['tokyo', 'kanagawa'], prompt: '完整正文', diagnostics: {} };
  globalThis.document = { getElementById: id => nodes.get(id), querySelector: () => null, querySelectorAll: () => [], dispatchEvent: event => dispatched.push(event), activeElement: null };
  const ui = { layout: 'desktop', esc: value => String(value ?? ''), engine: { data: { packages: [{ id: 'tokyo', displayName: '东京', layer: 'EX' }, { id: 'kanagawa', displayName: '神奈川', layer: 'EX' }], controlGroups: [] } }, bridge: { session: { runtime: { getLastActualInjection: () => record, getLastPreview: () => null } }, catalog: {} }, notify() {}, showPage: async () => { calls.push('unexpected showPage'); return false; }, openSettings: async (...args) => { calls.push(args); return false; } };
  const diagnostics = mountDiagnostics(ui);
  return { main, input: () => input, list: () => list, record, calls, dispatched, diagnostics, click: dataset => nodes.get('ljDiagnosticsPage').handlers.click({ target: { closest: () => ({ dataset }) } }), restore: () => { globalThis.document = previous; } };
}

test('diagnostic search keeps the same input during composition and refresh, filtering only after composition ends', () => {
  const f = diagnosticFixture();
  try {
    const input = f.input(), before = f.list().innerHTML;
    f.main.handlers.compositionstart?.({ target: input }); input.value = '东';
    f.main.handlers.input({ target: input, isComposing: true }); f.diagnostics.render();
    assert.equal(f.input(), input); assert.equal(f.list().innerHTML, before);
    input.value = '东京'; f.main.handlers.compositionend?.({ target: input });
    assert.equal(f.input(), input); assert.match(f.list().innerHTML, /东京/); assert.doesNotMatch(f.list().innerHTML, /神奈川/);
    input.value = ''; f.main.handlers.input({ target: input, isComposing: false });
    assert.equal(f.input(), input); assert.match(f.list().innerHTML, /神奈川/);
  } finally { f.restore(); }
});

test('the existing place summary explains only recorded administrative rejection reasons', () => {
  const f = diagnosticFixture();
  try {
    const cases = {
      administrative_context_missing: '未读到地点对应的行政区',
      administrative_context_ambiguous: '行政区名称有歧义，请补充市或都道府县',
      administrative_context_mismatch: '读取到的行政区与地点归属不符',
      newer_administrative_context: '已读取到较新的行政区，前文地点不再适用',
      place_administration_missing: '地点未登记可配对的行政区',
      ambiguous_named_place: '同一行政区有多个同名地点',
    };
    for (const [stopReason, message] of Object.entries(cases)) {
      f.record.diagnostics.placeMatch = { directPlaceIds: [], stopReason };
      f.diagnostics.render();
      assert.ok(f.list().innerHTML.includes(message), stopReason);
    }
    f.record.diagnostics.placeMatch.stopReason = 'no_match';
    f.diagnostics.render();
    assert.match(f.list().innerHTML, /未命中地点/);
    assert.doesNotMatch(f.list().innerHTML, /未读到地点对应的行政区/);
  } finally { f.restore(); }
});

test('diagnostic settings shortcut invokes the single gated entry without a second event or navigation', async () => {
  const f = diagnosticFixture();
  try { await f.click({ ljDiagSettings: 'EX' }); assert.deepEqual(f.calls, [['reading', 'EX']]); assert.deepEqual(f.dispatched, []); }
  finally { f.restore(); }
});

test('copying a filtered diagnostic still exports the full current record', async () => {
  const f = diagnosticFixture(), descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator'); let copied;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async value => { copied = value; } } } });
  try { const input = f.input(); input.value = '东京'; f.main.handlers.input({ target: input }); await f.click({ ljDiagAction: 'copy' }); assert.match(copied, /kanagawa/); assert.match(copied, /完整正文/); }
  finally { f.restore(); if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor); else delete globalThis.navigator; }
});

test('settings tab renderer has no duplicate navigation event owner and opens the requested channel', () => {
  const previous = globalThis.document, events = [], content = node(), tabs = node(), scrolled = [];
  globalThis.document = { activeElement: null, getElementById: id => id === 'set12Content' ? content : id === 'set12Tabs' ? tabs : id === 'lj-channel-EX' ? { scrollIntoView: () => scrolled.push('EX') } : null, addEventListener: name => events.push(name) };
  const settings = { textScript: 'simplified', wrapperMode: '', historyDepth: 0, currentUserBoundary: { start: '', end: '' }, channelTags: Object.fromEntries(['TN', 'EX', 'IN', 'EV'].map(key => [key, { priority: [], excluded: [] }])), layers: {} };
  const ui = { layout: 'desktop', esc: value => String(value ?? ''), bridge: { store: { read: () => ({ livingJapanSettings: settings, livingJapanTextOverrides: { records: {}, orphans: {} } }) }, catalog: { get: () => null } }, engine: { normalizeSettings: value => value, data: { wrappers: {} } } };
  try { const view = mountSettings(ui); assert(!events.includes('living-japan-settings-tab')); view.openTab('reading', 'EX'); assert.deepEqual(scrolled, ['EX']); assert.match(content.innerHTML, /保存读取设置/); }
  finally { globalThis.document = previous; }
});
