import test from 'node:test';
import assert from 'node:assert/strict';
import { entryDOM, entryStore } from './helpers/entry-dom.mjs';

import { createFloatingEntry as create } from '../src/floating-entry.js';

test('single click opens synchronously without waiting for a second click or runtime data', () => {
  const env = entryDOM(), store = entryStore(); let opened = 0;
  const entry = create({ ...env, store, open: () => opened++ });
  entry.button.fire('click'); assert.equal(opened, 1);
  entry.button.fire('click'); assert.equal(opened, 2); assert.deepEqual(store.read(), {});
  entry.destroy(); assert.equal(env.document.getElementById('living-japan-open'), null); assert.equal(store.subscribers, 0);
});

test('quick switches preserve unknown settings, per-item choices and personal text', async () => {
  const env = entryDOM(), store = entryStore({ livingJapanSettings: { masterEnabled: true, groups: { keep: false }, packages: { keep: false }, future: 9, layers: { TN: true, FUTURE: false } }, livingJapanTextOverrides: { records: { personal: 'my prose' } } });
  const entry = create({ ...env, store, open() {} }); entry.button.fire('contextmenu');
  const menu = env.document.getElementById('living-japan-floating-menu'); assert.equal(menu.hidden, false);
  menu.querySelector('[data-setting="masterEnabled"]').fire('click'); await Promise.resolve();
  menu.querySelector('[data-setting="layer:TN"]').fire('click'); await Promise.resolve();
  menu.querySelector('[data-setting="namedPlaceBodiesEnabled"]').fire('click'); await Promise.resolve();
  const value = store.read();
  assert.equal(value.livingJapanSettings.masterEnabled, false); assert.equal(value.livingJapanSettings.layers.TN, false);
  assert.equal(value.livingJapanSettings.namedPlaceBodiesEnabled, false); assert.equal(value.livingJapanSettings.layers.FUTURE, false);
  assert.deepEqual(value.livingJapanSettings.groups, { keep: false }); assert.deepEqual(value.livingJapanSettings.packages, { keep: false });
  assert.equal(value.livingJapanSettings.future, 9); assert.deepEqual(value.livingJapanTextOverrides.records, { personal: 'my prose' });
  assert.equal(entry.button.getAttribute('data-enabled'), 'false'); entry.destroy();
});

test('dragging saves a docked position and suppresses its synthetic click; resize retains the dock', async () => {
  const env = entryDOM(), store = entryStore(); let opened = 0;
  const entry = create({ ...env, store, open: () => opened++ });
  entry.button.fire('pointerdown', { clientX: 930, clientY: 630 });
  entry.button.fire('pointermove', { clientX: 980, clientY: 330 });
  entry.button.fire('pointerup', { clientX: 980, clientY: 330 }); await Promise.resolve();
  entry.button.fire('click'); assert.equal(opened, 0); assert.equal(store.read().extensionUi.entryDockEdge, 'right');
  assert.equal(store.read().extensionUi.entryPosition.x, 942);
  env.window.innerWidth = 700; env.window.fire('resize'); assert.equal(entry.control.style.left, '642px');
  env.tick(1800); assert.equal(entry.control.getAttribute('data-edge-hidden'), 'right');
  entry.setOpen(true); assert.equal(entry.control.getAttribute('data-edge-hidden'), null);
  entry.button.fire('click'); assert.equal(opened, 1); entry.destroy();
});

test('touch long press opens the quick menu without opening the panel and failure remains visible', async () => {
  const env = entryDOM(), store = entryStore(); let opened = 0;
  store.update = async () => { throw new Error('保存失败'); };
  const entry = create({ ...env, store, open: () => opened++ });
  entry.button.fire('pointerdown', { pointerType: 'touch' }); env.tick(580); entry.button.fire('pointerup'); entry.button.fire('click');
  const menu = env.document.getElementById('living-japan-floating-menu'); assert.equal(menu.hidden, false); assert.equal(opened, 0);
  menu.querySelector('[data-setting="masterEnabled"]').fire('click'); await Promise.resolve(); await Promise.resolve();
  assert.match(menu.querySelector('[role="alert"]').textContent, /保存失败/);
  assert.equal(entry.button.getAttribute('data-enabled'), 'true'); entry.destroy();
});

test('wrapper quick choices use runtime modes in reading order and only save the selected mode', async () => {
  const env = entryDOM(), original = { livingJapanSettings: { wrapperMode: 'background', historyDepth: 7, layers: { TN: false }, future: 9 }, livingJapanTextOverrides: { records: { keep: '个人正文' } } };
  const store = entryStore(original), entry = create({ ...env, store, open() {} });
  try {
    assert.equal(typeof entry.setWrapperChoices, 'function');
    entry.setWrapperChoices({ detailed: { label: '细写' }, background: { label: '背景（默认）' }, standard: { label: '标准' }, brief: { label: '简写' } });
    entry.openMenu();
    const menu = env.document.getElementById('living-japan-floating-menu'), choices = menu.querySelectorAll('[data-wrapper-mode]');
    assert.deepEqual(choices.map(row => row.dataset.wrapperMode), ['background', 'brief', 'standard', 'detailed']);
    assert.equal(choices[0].getAttribute('aria-checked'), 'true');
    choices[3].fire('click'); await Promise.resolve(); await Promise.resolve();
    assert.deepEqual(store.read(), { ...original, livingJapanSettings: { ...original.livingJapanSettings, wrapperMode: 'detailed' } });
    assert.equal(menu.hidden, false); assert.equal(choices[3].getAttribute('aria-checked'), 'true');
    await store.update(value => { value.livingJapanSettings.wrapperMode = 'brief'; });
    assert.equal(choices[1].getAttribute('aria-checked'), 'true');
    assert.equal(choices[3].getAttribute('aria-checked'), 'false');
    choices[1].focus(); menu.fire('keydown', { key: 'ArrowRight' });
    assert.equal(env.document.activeElement, choices[2]);
  } finally { entry.destroy(); }
});

test('wrapper save failure keeps the previous choice and a stopped master keeps the saved mode', async () => {
  const env = entryDOM(), store = entryStore({ livingJapanSettings: { wrapperMode: 'standard', masterEnabled: false } });
  const entry = create({ ...env, store, open() {} });
  try {
    entry.openMenu(); const menu = env.document.getElementById('living-japan-floating-menu');
    const standard = menu.querySelector('[data-wrapper-mode="standard"]'), detailed = menu.querySelector('[data-wrapper-mode="detailed"]');
    assert.ok(standard); assert.ok(detailed); assert.equal(standard.getAttribute('aria-checked'), 'true');
    store.update = async () => { throw Error('保存失败，请重试'); };
    detailed.fire('click'); await Promise.resolve(); await Promise.resolve();
    assert.equal(standard.getAttribute('aria-checked'), 'true'); assert.equal(detailed.getAttribute('aria-checked'), 'false');
    assert.equal(store.read().livingJapanSettings.wrapperMode, 'standard');
    assert.match(menu.querySelector('[role="alert"]').textContent, /保存失败/); assert.equal(menu.hidden, false);
  } finally { entry.destroy(); }
});
