import test from 'node:test';
import assert from 'node:assert/strict';
import { createFloatingEntry } from '../src/floating-entry.js';
import { mountSettings } from '../ui/settings.js';
import { mountDiagnostics } from '../ui/diagnostics.js';
import { entryDOM, entryStore } from './helpers/entry-dom.mjs';

const key = 'skipUserLocationInput';
const clone = value => structuredClone(value);
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const decode = value => String(value).replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
const dataKey = value => value.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

function node(tag = 'div', attrs = {}, parent = null) {
  const value = { tagName: tag.toUpperCase(), attrs: { ...attrs }, parentElement: parent, children: [], handlers: {}, dataset: {},
    value: attrs.value || '', scrollTop: 0, textContent: '', hidden: false, style: {} };
  for (const [name, text] of Object.entries(attrs)) if (name.startsWith('data-')) value.dataset[dataKey(name)] = text;
  value.setAttribute = (name, text) => { value.attrs[name] = String(text); };
  value.getAttribute = name => value.attrs[name] ?? null;
  value.hasAttribute = name => name in value.attrs;
  value.classList = {
    contains: name => (value.attrs.class || '').split(/\s+/).includes(name),
    add(...names) { value.attrs.class = [...new Set([...(value.attrs.class || '').split(/\s+/), ...names])].filter(Boolean).join(' '); },
    remove(...names) { value.attrs.class = (value.attrs.class || '').split(/\s+/).filter(name => !names.includes(name)).join(' '); },
    toggle(name, on = !this.contains(name)) { if (on) this.add(name); else this.remove(name); },
  };
  value.matches = selector => selector.split(',').some(part => {
    const outside = part.trim().replace(/\[[^\]]*\]/g, '');
    const tagName = outside.match(/^[a-z][\w-]*/i)?.[0], id = outside.match(/#([\w-]+)/)?.[1];
    if (tagName && tagName.toUpperCase() !== value.tagName || id && id !== value.attrs.id) return false;
    if ([...outside.matchAll(/\.([\w-]+)/g)].some(match => !value.classList.contains(match[1]))) return false;
    return [...part.matchAll(/\[([^=\]\s]+)(?:=["']?([^\]"']*)["']?)?\]/g)]
      .every(([, name, text]) => name in value.attrs && (text === undefined || value.attrs[name] === text));
  });
  value.closest = selector => value.matches(selector) ? value : parent?.closest(selector) || null;
  value.querySelectorAll = selector => value.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  value.querySelector = selector => value.querySelectorAll(selector)[0] || null;
  value.contains = other => other === value || value.children.some(child => child.contains(other));
  value.addEventListener = (name, callback) => { (value.handlers[name] ||= []).push(callback); };
  value.getBoundingClientRect = () => ({ top: 0, height: 100 });
  value.focus = () => { globalThis.document.activeElement = value; };
  value.scrollIntoView = () => {};
  let html = '';
  Object.defineProperty(value, 'innerHTML', { get: () => html, set(text) {
    html = text; value.children = []; const stack = [value];
    for (const match of text.matchAll(/<\/?([a-z][\w-]*)([^>]*)>/gi)) {
      const tagName = match[1].toLowerCase();
      if (match[0].startsWith('</')) { if (stack.length > 1 && stack.at(-1).tagName === tagName.toUpperCase()) stack.pop(); continue; }
      const fields = {};
      for (const field of match[2].matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) fields[field[1]] = decode(field[2] ?? field[3] ?? field[4] ?? '');
      const child = node(tagName, fields, stack.at(-1)); stack.at(-1).children.push(child);
      if (!['input', 'br', 'hr', 'img', 'meta', 'link'].includes(tagName)) stack.push(child);
    }
  } });
  return value;
}

function documentFixture(layout, pageName) {
  const previous = globalThis.document, page = node('section', { id: pageName === 'diagnostic' ? 'ljDiagnosticsPage' : '', 'data-page-root': pageName });
  const unload = [];
  globalThis.document = { body: node('body'), activeElement: null,
    defaultView: { addEventListener(name, callback) { if (name === 'unload') unload.push(callback); } },
    getElementById: id => page.attrs.id === id ? page : page.querySelector('#' + id),
    querySelector: selector => page.matches(selector) ? page : page.querySelector(selector),
    querySelectorAll: selector => page.querySelectorAll(selector),
  };
  const ids = pageName === 'settings' ? layout === 'desktop' ? ['set12Content', 'set12Tabs'] : ['settingsScroll', 'settingsTabs']
    : layout === 'desktop' ? ['check11Records', 'check11Summary', 'check11Tabs', 'check11Content'] : [];
  for (const id of ids) page.children.push(node('div', { id }, page));
  return { page, restore() { unload.forEach(callback => callback()); globalThis.document = previous; } };
}

function settingsFixture(layout) {
  const env = documentFixture(layout, 'settings');
  const saved = { livingJapanSettings: { masterEnabled: true, namedPlaceBodiesEnabled: true, layers: { TN: true, EX: true, IN: true, EV: true },
    textScript: 'simplified', wrapperMode: '', historyDepth: 2, currentUserBoundary: { start: '', end: '' },
    channelTags: Object.fromEntries(['TN', 'EX', 'IN', 'EV'].map(layer => [layer, { priority: [], excluded: [] }])) },
    livingJapanTextOverrides: { records: { keep: { body: '个人正文' } }, orphans: {} }, extensionUi: {} };
  const store = entryStore(saved), content = document.getElementById(layout === 'desktop' ? 'set12Content' : 'settingsScroll');
  const ui = { layout, esc, state: {}, notify() {},
    engine: { normalizeSettings: value => ({ ...clone(value), [key]: value[key] === true }),
      normalizeTextOverrides: value => clone({ records: {}, orphans: {}, ...value }), data: { wrappers: {} } },
    bridge: { store, subscribe: callback => store.subscribe(callback), catalog: { get: () => null }, session: { async refresh() {},
      runtime: { saveSettings: async value => store.update(draft => { draft.livingJapanSettings = value; }) } } },
  };
  const view = mountSettings(ui);
  const dispatch = async (name, target) => { for (const callback of content.handlers[name] || []) await callback({ target, preventDefault() {} }); };
  return { ...env, content, view, store, ui, dispatch, button: () => content.querySelector(`[data-settings-common="${key}"]`) };
}

test('location quick switch defaults off and preserves other saved choices', async () => {
  const env = entryDOM(), store = entryStore({ livingJapanSettings: { layers: { TN: true, EX: true }, historyDepth: 3 }, livingJapanTextOverrides: { records: { keep: '个人正文' } } });
  const entry = createFloatingEntry({ ...env, store, open() {} });
  try {
    const button = env.document.querySelector(`[data-setting="${key}"]`);
    assert.ok(button, 'new quick switch is present');
    assert.equal(button.getAttribute('aria-checked'), 'false');
    button.fire('click'); await Promise.resolve(); await Promise.resolve();
    assert.equal(store.read().livingJapanSettings[key], true);
    assert.equal(button.getAttribute('aria-checked'), 'true');
    assert.deepEqual(store.read().livingJapanSettings.layers, { TN: true, EX: true });
    assert.equal(store.read().livingJapanTextOverrides.records.keep, '个人正文');
  } finally { entry.destroy(); }
});

for (const layout of ['desktop', 'portrait', 'mobile']) test(`${layout} location setting and quick menu share immediate saved state`, async () => {
  const f = settingsFixture(layout), menuEnv = entryDOM(), entry = createFloatingEntry({ ...menuEnv, store: f.store, open() {} });
  try {
    const menuButton = menuEnv.document.querySelector(`[data-setting="${key}"]`);
    assert.ok(f.button(), 'new settings switch is present');
    assert.equal(f.button().getAttribute('aria-pressed'), 'false');
    f.view.openTab('reading');
    const draft = f.content.querySelector('[data-settings-reading="historyDepth"]'); draft.value = '7'; draft.focus();
    await f.dispatch('input', draft);
    f.view.openTab('common');
    menuButton.fire('click'); await Promise.resolve(); await Promise.resolve();
    assert.equal(f.button().getAttribute('aria-pressed'), 'true');
    assert.equal(f.view.hasUnsaved(), true);
    assert.equal(f.store.read().livingJapanSettings.historyDepth, 2);
    await f.dispatch('click', f.button());
    assert.equal(f.store.read().livingJapanSettings[key], false);
    assert.equal(menuButton.getAttribute('aria-checked'), 'false');
    f.view.openTab('reading'); assert.equal(f.content.querySelector('[data-settings-reading="historyDepth"]').value, '7');
  } finally { entry.destroy(); f.restore(); }
});

for (const layout of ['desktop', 'portrait', 'mobile']) test(`${layout} diagnostics names direct places without counting them as prose`, () => {
  const f = documentFixture(layout, 'diagnostic');
  const record = { status: 'expanded', packageIds: [], diagnostics: { placeMatch: { directPlaceIds: ['small'],
    matches: [{ id: 'small', displayName: '甲生活带', trigger: '甲生活带', source: { source: 'assistant_history', historyIndex: 1 } }] } } };
  const ui = { layout, esc, notify() {}, engine: { normalizeSettings: value => value, data: { packages: [], controlGroups: [],
    canonicalPlaceContexts: { rows: { legacy: { id: 'legacy', name: '旧记录片区' } }, aliases: {} } } },
    bridge: { catalog: {}, store: { read: () => ({ livingJapanSettings: {} }) },
      session: { runtime: { getLastActualInjection: () => record, getLastPreview: () => null } } } };
  try {
    const view = mountDiagnostics(ui);
    const summary = () => document.getElementById(layout === 'desktop' ? 'check11Summary' : 'diagSummary');
    const heading = () => layout === 'desktop' ? summary().innerHTML : document.getElementById('diagScope').textContent;
    assert.match(heading(), /本次直接命中：甲生活带/);
    assert.match(heading(), /向上第 1 层 AI 回复/);
    assert.match(summary().innerHTML, /<b>0<\/b>/);
    record.diagnostics = { livingAreaExpansion: { directPlaceIds: ['legacy'] } }; view.render();
    assert.match(heading(), /本次直接命中：旧记录片区/);
    record.diagnostics = { placeMatch: { directPlaceIds: [], matches: [] }, livingAreaExpansion: { directPlaceIds: ['legacy'] } }; view.render();
    assert.match(heading(), /未命中地点/); assert.doesNotMatch(heading(), /旧记录片区/);
  } finally { f.restore(); }
});

for (const layout of ['desktop', 'portrait', 'mobile']) test(`${layout} wrapper quick change survives saving a different reading draft`, async () => {
  const f = settingsFixture(layout);
  try {
    f.ui.engine.data.wrappers = Object.fromEntries(['background', 'brief', 'standard', 'detailed'].map(id => [id, { label: id }]));
    await f.store.update(value => { value.livingJapanSettings.wrapperMode = 'background'; });
    f.view.openTab('reading');
    const history = f.content.querySelector('[data-settings-reading="historyDepth"]'); history.value = '7'; history.focus();
    await f.dispatch('input', history);
    await f.store.update(value => { value.livingJapanSettings.wrapperMode = 'detailed'; });
    assert.equal(f.content.querySelector('[data-settings-reading="wrapperMode"]').value, 'detailed');
    assert.equal(history.value, '7'); assert.equal(f.view.hasUnsaved(), true);
    await f.dispatch('click', f.content.querySelector('[data-settings-action="save-reading"]'));
    assert.equal(f.store.read().livingJapanSettings.wrapperMode, 'detailed');
    assert.equal(f.store.read().livingJapanSettings.historyDepth, 7);
    const wrapper = f.content.querySelector('[data-settings-reading="wrapperMode"]'); wrapper.value = 'brief';
    await f.dispatch('input', wrapper);
    await f.store.update(value => { value.livingJapanSettings.skipUserLocationInput = true; });
    assert.equal(wrapper.value, 'brief', 'an unrelated saved switch does not replace an unsaved setting choice');
    await f.dispatch('click', f.content.querySelector('[data-settings-action="save-reading"]'));
    assert.equal(f.store.read().livingJapanSettings.wrapperMode, 'brief');
  } finally { f.restore(); }
});
