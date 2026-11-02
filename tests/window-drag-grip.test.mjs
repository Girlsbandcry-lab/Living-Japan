import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const controller = fs.readFileSync(new URL('../ui/controller.js', import.meta.url), 'utf8');
const setup = controller.slice(controller.indexOf('const unmountWindowDrags='), controller.indexOf('modules.region=mountBrowser'));
const cleanup = controller.match(/window\.addEventListener\('unload',[^\n]+/)[0];

function fixture(layout) {
  const html = fs.readFileSync(new URL(`../ui/${layout}.html`, import.meta.url), 'utf8');
  const headers = [...html.matchAll(/<header class="(top7|top)"/g)].map(([, className]) => ({
    className, children: [], prepend(child) { this.children.unshift(child); },
  }));
  const mounted = [], removed = [], events = {};
  vm.runInNewContext(`${setup}\n${cleanup}`, {
    layout,
    $$: selector => headers.filter(header => selector.split(',').includes(`.${header.className}`)),
    document: { createElement: tagName => ({ tagName, dataset: {}, setAttribute(name, value) { this[name] = value; } }) },
    bridge: { mountWindowDrag(header) { mounted.push(header); return () => removed.push(header); } },
    window: { addEventListener(name, callback) { events[name] = callback; } },
    unsubscribe() {}, ui: { guide: { destroy() {} }, updateIndicator: { destroy() {} } }, modules: {},
  });
  return { headers, mounted, removed, unload: events.unload };
}

for (const layout of ['desktop', 'portrait']) {
  test(`${layout} keeps every page header draggable and cleans every listener when closed`, () => {
    const f = fixture(layout);
    assert.equal(f.mounted.length, f.headers.length);
    if (layout === 'desktop') assert.ok(f.headers.length > 1, 'exercise the separate desktop page headers');
    for (const header of f.headers) {
      assert.equal(header.children.length, 1);
      const grip = header.children[0];
      assert.equal(grip.tagName, 'span', 'the drag target must pass the existing button exclusion');
      assert.equal(grip.dataset.windowGrip, 'true');
      assert.match(grip.title, /拖动窗口/);
    }
    f.unload();
    assert.deepEqual(f.removed, f.mounted);
  });
}

test('fixed mobile layout does not advertise or bind window dragging', () => {
  const f = fixture('mobile');
  assert.ok(f.headers.length);
  assert.equal(f.mounted.length, 0);
  assert.ok(f.headers.every(header => header.children.length === 0));
  f.unload();
  assert.equal(f.removed.length, 0);
});
