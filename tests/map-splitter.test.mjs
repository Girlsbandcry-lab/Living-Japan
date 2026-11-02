import test from 'node:test';
import assert from 'node:assert/strict';
import { mountMapSplitter } from '../ui/map-splitter.js';

function fixture({ layout = 'portrait', scale = 1, state = {}, onCommit } = {}) {
  const size = { page: 812, route: 94, map: 319, beforeList: 152.687, rows: [57, 57, 57, 57], scale };
  const resize = new Set(), classes = new Set();
  let observer;
  const view = {
    addEventListener(name, fn) { if (name === 'resize') resize.add(fn); },
    removeEventListener(name, fn) { if (name === 'resize') resize.delete(fn); },
    ResizeObserver: class { constructor(fn) { this.fn = fn; observer = this; } observe() {} disconnect() { this.disconnected = true; } },
  };
  const doc = { defaultView: view, createElement() { return node(); } };
  function node() {
    const listeners = new Map(), attrs = new Map(), captured = new Set();
    return { ownerDocument: doc, style: {}, hidden: false, children: [],
      classList: { add: value => classes.add(value), remove: value => classes.delete(value) },
      setAttribute: (key, value) => attrs.set(key, String(value)), getAttribute: key => attrs.get(key),
      addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name),
      appendChild(child) { this.children.push(child); child.parentElement = this; },
      remove() { this.removed = true; }, focus() {}, querySelector() { return null; },
      setPointerCapture: id => captured.add(id), hasPointerCapture: id => captured.has(id), releasePointerCapture: id => captured.delete(id),
      fire(name, extra = {}) { let prevented = false; listeners.get(name)?.({ pointerId: 1, button: 0, isPrimary: true, clientY: 0, preventDefault() { prevented = true; }, stopPropagation() {}, ...extra }); return prevented; },
      listeners, captured,
    };
  }
  const page = node(), map = node(), feed = node(), related = node(), route = node();
  const mapHeight = () => Number.isFinite(parseFloat(page.style.gridTemplateRows)) ? parseFloat(page.style.gridTemplateRows) : size.map;
  const rect = (top, height) => ({ top: top * size.scale, bottom: (top + height) * size.scale, height: height * size.scale });
  Object.defineProperty(page, 'clientHeight', { get: () => size.page });
  page.getBoundingClientRect = () => rect(0, page.hidden ? 0 : size.page);
  map.getBoundingClientRect = () => rect(0, mapHeight());
  feed.scrollTop = 0;
  feed.getBoundingClientRect = () => rect(mapHeight(), size.page - size.route - mapHeight());
  related.getBoundingClientRect = () => rect(mapHeight() + size.beforeList - feed.scrollTop, size.rows.reduce((a, b) => a + b, 0));
  route.getBoundingClientRect = () => rect(size.page - size.route, size.route);
  const fillRows = () => { related.children = size.rows.map((height, index) => ({ getBoundingClientRect: () => rect(mapHeight() + size.beforeList - feed.scrollTop + size.rows.slice(0, index).reduce((a, b) => a + b, 0), height) })); };
  fillRows();
  const splitter = mountMapSplitter({ page, map, feed, related, route, state, layout, onCommit });
  return { size, state, page, map, feed, related, route, splitter, handle: page.children[0], mapHeight, fillRows,
    resize() { observer?.fn(); for (const fn of resize) fn(); }, get observer() { return observer; }, classes };
}

test('default approved grid remains untouched until an actual drag or key change', () => {
  const f = fixture();
  assert.equal(f.page.style.gridTemplateRows, undefined);
  assert.equal(f.handle.style.top, '319px');
  assert.equal(f.handle.getAttribute('role'), 'separator');
  assert.deepEqual(f.state, {});
  f.handle.fire('pointerdown', { clientY: 320 });
  f.handle.fire('pointerup', { clientY: 320 });
  assert.equal(f.page.style.gridTemplateRows, undefined);
});

test('drag down stops at two actual related rows and keeps the route outside the resized area', () => {
  const f = fixture();
  f.handle.fire('pointerdown', { clientY: 319 });
  assert.equal(f.handle.captured.has(1), true);
  f.handle.fire('pointermove', { clientY: 1500 });
  assert.ok(Math.abs(f.mapHeight() - 451.313) < 0.001);
  assert.ok(Math.abs(f.feed.getBoundingClientRect().height - 266.687) < 0.001);
  assert.equal(f.route.getBoundingClientRect().height, 94);
  assert.equal(f.state.portrait, f.mapHeight());
  f.handle.fire('pointercancel');
  assert.equal(f.handle.captured.size, 0);
  const before = f.mapHeight();
  f.handle.fire('pointermove', { clientY: 100 });
  assert.equal(f.mapHeight(), before);
});

test('touch-scaled coordinates and a scrolled feed still use unscrolled content geometry', () => {
  const f = fixture({ layout: 'mobile', scale: 0.8 });
  f.feed.scrollTop = 80;
  f.handle.fire('pointerdown', { pointerType: 'touch', clientY: 319 * 0.8 });
  f.handle.fire('pointermove', { pointerType: 'touch', clientY: (319 + 50) * 0.8 });
  assert.ok(Math.abs(f.mapHeight() - 369) < 0.001);
  f.handle.fire('keydown', { key: 'End' });
  assert.ok(Math.abs(f.mapHeight() - 451.313) < 0.001);
  assert.equal(f.state.mobile, f.mapHeight());
  assert.equal(f.state.portrait, undefined);
});

test('keyboard and resized long-title limits use the same geometry without changing session preference', () => {
  const f = fixture();
  f.handle.fire('keydown', { key: 'End' });
  const preferred = f.state.portrait;
  f.size.beforeList += 50;
  f.resize();
  assert.ok(Math.abs(f.mapHeight() - (preferred - 50)) < 0.001);
  assert.equal(f.state.portrait, preferred);
  f.handle.fire('keydown', { key: 'Home' });
  assert.equal(f.mapHeight(), 130);
  f.handle.fire('keydown', { key: 'ArrowDown' });
  assert.equal(f.mapHeight(), 154);
  f.handle.fire('keydown', { key: 'ArrowUp' });
  assert.equal(f.mapHeight(), 130);
  f.size.page = 320;
  f.resize();
  assert.equal(f.mapHeight(), 0);
  assert.equal(f.route.getBoundingClientRect().height, 94);
});

test('zero or one related row uses only available items; hidden full-map page is not resized', () => {
  const f = fixture();
  f.size.rows = [57]; f.fillRows();
  f.handle.fire('keydown', { key: 'End' });
  assert.ok(Math.abs(f.mapHeight() - (812 - 94 - 152.687 - 57)) < 0.001);
  f.page.hidden = true;
  const before = f.page.style.gridTemplateRows;
  f.size.page = 700; f.resize();
  assert.equal(f.page.style.gridTemplateRows, before);
  f.page.hidden = false; f.size.rows = []; f.fillRows(); f.resize();
  f.handle.fire('keydown', { key: 'End' });
  assert.ok(Math.abs(f.mapHeight() - (700 - 94 - 152.687)) < 0.001);
});

test('a remounted narrow view restores session height and destroy releases listeners', () => {
  const state = {};
  const first = fixture({ state });
  first.handle.fire('keydown', { key: 'End' });
  const height = first.mapHeight();
  first.splitter.destroy();
  assert.equal(first.handle.removed, true);
  assert.equal(first.handle.listeners.size, 0);
  assert.equal(first.observer.disconnected, true);
  assert.equal(fixture({ state }).mapHeight(), height);
});

test('a drag commits only its final actual change; clicks, canceled capture repeats and automatic clamps do not save', () => {
  const commits = [], f = fixture({ onCommit: height => commits.push(height) });
  f.handle.fire('pointerdown', { clientY: 319 }); f.handle.fire('pointerup', { clientY: 319 });
  assert.deepEqual(commits, []);
  f.handle.fire('pointerdown', { clientY: 319 });
  for (const clientY of [330, 350, 380]) f.handle.fire('pointermove', { clientY });
  assert.deepEqual(commits, [], 'live movement stays in memory');
  f.handle.fire('pointerup'); f.handle.fire('lostpointercapture');
  assert.deepEqual(commits, [380]);
  f.size.beforeList += 150; f.resize();
  assert.equal(f.state.portrait, 380); assert.deepEqual(commits, [380]);
  f.size.beforeList -= 150; f.resize(); assert.equal(f.mapHeight(), 380);
  f.handle.fire('pointerdown', { clientY: 380 });
  f.handle.fire('pointermove', { clientY: 400 }); f.handle.fire('pointermove', { clientY: 380 }); f.handle.fire('pointerup');
  assert.deepEqual(commits, [380], 'returning to the starting height is not a changed preference');
  f.handle.fire('keydown', { key: 'ArrowDown' });
  assert.deepEqual(commits, [380, 404]);
  f.handle.fire('keydown', { key: 'Home' }); f.handle.fire('keydown', { key: 'Home' });
  assert.deepEqual(commits, [380, 404, 130], 'a key stopped at a limit does not write again');
  f.handle.fire('pointerdown', { clientY: 130 }); f.handle.fire('pointermove', { clientY: 154 });
  f.handle.fire('pointercancel'); f.handle.fire('lostpointercapture');
  assert.deepEqual(commits, [380, 404, 130, 154], 'canceled capture completes a changed gesture once');
});

test('a no-op gesture while temporarily clamped does not replace the larger saved preference', () => {
  const commits = [], f = fixture({ state: { portrait: 420 }, onCommit: height => commits.push(height) });
  f.size.beforeList += 100; f.resize();
  const clamped = f.mapHeight();
  f.handle.fire('pointerdown', { clientY: clamped });
  f.handle.fire('pointermove', { clientY: clamped + 100 }); f.handle.fire('pointerup');
  f.handle.fire('keydown', { key: 'End' });
  assert.equal(f.state.portrait, 420); assert.deepEqual(commits, []);
  f.size.beforeList -= 100; f.resize(); assert.equal(f.mapHeight(), 420);
});
