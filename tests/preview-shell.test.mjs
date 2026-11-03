import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createCanonicalContextPreparer } from '../src/place-identities.js';

// Exercise the real shell and preview handlers without loading map data or writing user files.
async function host(width = 1200, height = 768, inputTop = height - 120, initialSaved = null, environment = {}) {
  const nodes = [], documentListeners = new Map(), subscribers = new Set();
  const windowListeners = new Map(), observers = [];
  let saved = initialSaved ? structuredClone(initialSaved) : { livingJapanSettings: {}, livingJapanUIPreferences: {}, extensionUi: { layout: 'auto', pinned: false }, customSlots: {} };
  const control = { allowLeave: true, leaveCalls: 0, workflowOpen: false };
  function element(tag) {
    const listeners = new Map();
    const node = { tag, tagName: tag.toUpperCase(), id: '', children: [], dataset: {}, style: {}, hidden: false, rect: null,
      setAttribute() {}, append(...children) { this.children.push(...children); },
      closest() { return this.tag === 'button' ? this : null; },
      getBoundingClientRect() {
        if (this.rect) return this.rect;
        let left = parseFloat(this.style.left) || 0, top = parseFloat(this.style.top) || 0, width = parseFloat(this.style.width) || 0, height = parseFloat(this.style.height) || 0;
        if (tag === 'iframe') {
          const viewport = document.getElementById('living-japan-viewport'), shell = document.getElementById('living-japan-shell');
          const scale = Number(this.style.transform?.match(/scale\(([^)]+)\)/)?.[1]) || 1;
          left += parseFloat(viewport.style.left) + 5; top += parseFloat(viewport.style.top) + 5;
          width = (width || parseFloat(shell.style.width) - 2) * scale; height = (height || parseFloat(shell.style.height) - 2) * scale;
        }
        return { left, top, width, height, right: left + width, bottom: top + height };
      },
      contains(target) { return this === target || this.children.some(child => child.contains(target)); },
      addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); },
      removeEventListener(name, fn) { const list = listeners.get(name) || []; listeners.set(name, list.filter(item => item !== fn)); }, remove() {}, setPointerCapture() {}, releasePointerCapture() {},
      fire(name, values = {}) { for (const fn of listeners.get(name) || []) fn({ target: this, preventDefault() {}, stopPropagation() {}, ...values }); },
      async click() {
        const event = { target: this, stopped: false, stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.stopped = true; } };
        const pending = [this.onclick?.(event), ...(listeners.get('click') || []).map(fn => fn(event))];
        if (!event.stopped) for (const fn of documentListeners.get('click') || []) fn(event);
        await Promise.all(pending); await Promise.resolve();
      },
    };
    if (tag === 'iframe') {
      node.contentDocument = { activeElement: null };
      node.contentWindow = { document: node.contentDocument, LivingJapanView: { leave: async () => { control.leaveCalls++; return control.allowLeave; } } };
      Object.defineProperty(node, 'clientWidth', { get: () => parseFloat(node.style.width) || parseFloat(document.getElementById('living-japan-shell')?.style.width) - 2 });
      Object.defineProperty(node, 'clientHeight', { get: () => parseFloat(node.style.height) || parseFloat(document.getElementById('living-japan-shell')?.style.height) - 2 });
    }
    nodes.push(node); return node;
  }
  const document = { body: element('body'), createElement: element,
    getElementById: id => nodes.find(node => node.id === id),
    addEventListener(name, fn) { if (!documentListeners.has(name)) documentListeners.set(name, new Set()); documentListeners.get(name).add(fn); },
    removeEventListener(name, fn) { documentListeners.get(name)?.delete(fn); },
  };
  for (const id of ['previewStatus', 'openApp', 'layoutDesktop', 'layoutPortrait', 'layoutMobile', 'simulate', 'send_textarea', 'outputCount']) { const node = element(id === 'send_textarea' ? 'textarea' : 'button'); node.id = id; document.body.append(node); }
  document.getElementById('send_textarea').rect = { left: 16, top: inputTop, width: width - 32, height: 72, bottom: inputTop + 72 };
  const store = { load: async () => {}, read: () => saved,
    async update(mutator) { saved = mutator(structuredClone(saved)); for (const fn of subscribers) fn(saved); },
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
  };
  const visualListeners = new Map();
  const view = { innerWidth: width, innerHeight: height, navigator: { maxTouchPoints: environment.touch ? 5 : 0 },
    screen: environment.screen || { width, height }, getComputedStyle: () => ({ lineHeight: '20px', paddingTop: '4px', paddingBottom: '4px' }),
    visualViewport: { width, height, offsetLeft: 0, offsetTop: 0,
      addEventListener(name, fn) { if (!visualListeners.has(name)) visualListeners.set(name, new Set()); visualListeners.get(name).add(fn); },
      removeEventListener(name, fn) { visualListeners.get(name)?.delete(fn); },
    },
    addEventListener(name, fn) { if (!windowListeners.has(name)) windowListeners.set(name, new Set()); windowListeners.get(name).add(fn); },
    removeEventListener(name, fn) { windowListeners.get(name)?.delete(fn); },
    ResizeObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} disconnect() {} },
  };
  const initialVisual = view.visualViewport;
  const sandbox = vm.createContext({ document, window: view, URL, console, performance, fetch, createCanonicalContextPreparer,
    createFloatingEntry: ({open}) => {const button=element('button');button.id='living-japan-open';document.body.append(button);button.addEventListener('click',open);return {button,control:button,setOpen(){},destroy(){}};},
    loadBaseline: async () => ({ data: { defaultSettings: {}, releaseId: 'fixture' }, engine: {} }),
    addUserSlotsToData() {}, createUserStore: () => store, createSillyTavernTransport: () => ({}),
    createSession: () => ({ start: async () => {}, stop() {}, engine: {} }),
    createWorkflowTourHost: () => ({
      offer: async () => false,
      start: async () => { control.workflowOpen = true; return true; },
      isOpen: () => control.workflowOpen,
      close() { control.workflowOpen = false; },
      destroy() { control.workflowOpen = false; },
    }),
    createUpdateManager: () => ({ check: async () => {} }), createCatalog: () => ({ loadIndex: async () => ({}), destroy() {} }),
  });
  const appSource = (await readFile(new URL('../src/app.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '').replace('export async function', 'async function');
  vm.runInContext(appSource, sandbox);
  const previewSource = (await readFile(new URL('../scripts/preview-host.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '').replaceAll('import.meta.url', JSON.stringify('http://localhost/scripts/preview-host.js'));
  await vm.runInContext(`(async () => {${previewSource}\n})()`, sandbox);
  return { document, window: view, control, bridge: sandbox.LivingJapanBridge, shell: document.getElementById('living-japan-shell'), read: store.read,
    resize() { if (view.visualViewport === initialVisual) { view.visualViewport.width = view.innerWidth; view.visualViewport.height = view.innerHeight; } for (const fn of windowListeners.get('resize') || []) fn(); },
    visualResize(values) { Object.assign(view.visualViewport, values); for (const fn of visualListeners.get('resize') || []) fn(); },
    inputResize() { for (const observer of observers) observer.fn(); },
  };
}

test('window resizing preserves the current iframe across breakpoints; explicit choices alone change layout', async () => {
  const h = await host(430);
  assert.equal(h.shell.dataset.layout, 'mobile');
  await h.bridge.setLayout('desktop'); assert.equal(h.shell.dataset.layout, 'desktop');
  await h.bridge.setLayout('portrait'); assert.equal(h.shell.dataset.layout, 'portrait');
  await h.bridge.setLayout('auto'); assert.equal(h.shell.dataset.layout, 'mobile');
  const frame = h.shell.children[0], mobileSource = frame.src;
  h.control.allowLeave = false;
  h.window.innerWidth = 1200; h.resize();
  assert.equal(h.shell.dataset.layout, 'mobile'); assert.equal(frame.src, mobileSource, 'resize must not reload a draft-bearing iframe');
  assert.equal(await h.bridge.setLayout('auto'), false, 'explicit layout change still respects the unsaved draft confirmation');
  h.control.allowLeave = true;
  await h.bridge.setLayout('auto'); assert.equal(h.shell.dataset.layout, 'desktop');
  const desktopSource = frame.src;
  h.window.innerWidth = 430; h.resize();
  assert.equal(h.shell.dataset.layout, 'desktop'); assert.equal(frame.src, desktopSource);
  h.bridge.destroy();
});

test('unlocked preview layout and open buttons keep the workspace visible', async () => {
  const h = await host();
  await h.document.getElementById('layoutPortrait').click();
  assert.equal(h.shell.dataset.layout, 'portrait'); assert.equal(h.shell.hidden, false);
  await h.bridge.close(); assert.equal(h.shell.hidden, true);
  await h.document.getElementById('openApp').click(); assert.equal(h.shell.hidden, false);
  await h.bridge.close();
  await h.document.getElementById('layoutDesktop').click();
  assert.equal(h.shell.dataset.layout, 'desktop'); assert.equal(h.shell.hidden, false);
  h.bridge.destroy();
});

test('cancelled leave preserves the layout and does not reopen a closed workspace', async () => {
  const h = await host();
  await h.bridge.close(); h.control.allowLeave = false;
  await h.document.getElementById('layoutPortrait').click();
  assert.equal(h.shell.dataset.layout, 'desktop'); assert.equal(h.shell.hidden, true);
  assert.equal(h.read().extensionUi.layout, 'auto');
  h.bridge.destroy();
});

test('workflow presentation blocks background dismissal without leaving or replacing the live workspace', async () => {
  const h = await host(), frame = h.shell.children[0], source = frame.src;
  const draft = { text: 'still editing' }, saved = structuredClone(h.read());
  frame.contentWindow.pendingDraft = draft;
  await h.bridge.workflowTour.start('all');
  await h.document.body.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.shell.hidden, false);
  assert.equal(h.control.leaveCalls, 0, 'background clicks during the workflow must not ask the live draft to leave');
  assert.equal(h.shell.children[0], frame);
  assert.equal(frame.src, source);
  assert.equal(frame.contentWindow.pendingDraft, draft);
  assert.deepEqual(h.read(), saved);
  h.bridge.workflowTour.close();
  await h.document.body.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.shell.hidden, true, 'ending the workflow restores normal unlocked-window dismissal');
  assert.equal(h.control.leaveCalls, 1);
  h.bridge.destroy();
});

test('the desktop uses the approved 8:5 shape and browser height with a scrollable minimum', async () => {
  const h = await host(1366);
  assert.equal(parseFloat(h.shell.style.width), 1216);
  assert.equal(parseFloat(h.shell.style.height), 760);
  const viewport = h.document.getElementById('living-japan-viewport');
  assert.equal(parseFloat(viewport.style.top) + parseFloat(viewport.style.height), 768);
  const frame = h.shell.children.find(node => node.tag === 'iframe'), originalSource = frame.src;
  h.window.innerWidth = 900; h.window.innerHeight = 600;
  h.document.getElementById('send_textarea').rect.top = 480; h.resize();
  assert.equal(parseFloat(h.shell.style.width), 960);
  assert.equal(parseFloat(h.shell.style.height), 600);
  assert.equal(parseFloat(viewport.style.width), 900);
  assert.equal(parseFloat(viewport.style.height), 600);
  assert.equal(frame.src, originalSource);
  await h.bridge.setLayout('portrait');
  assert.equal(parseFloat(h.shell.style.width), 320);
  assert.equal(parseFloat(h.shell.style.height), 640);
  h.bridge.destroy();
});

test('PC input growth never shrinks or moves the workspace or changes saved geometry', async () => {
  const h = await host(1600, 1000, 880);
  const frame = h.shell.children.find(node => node.tag === 'iframe'), originalSource = frame.src;
  const before = parseFloat(h.shell.style.height);
  const viewport = h.document.getElementById('living-japan-viewport');
  const originalBox = viewport.getBoundingClientRect(), saved = structuredClone(h.read());
  assert.equal(before, 992);
  for (const top of [620, 80, 0, 880]) {
    h.document.getElementById('send_textarea').rect.top = top; h.inputResize();
    assert.equal(parseFloat(h.shell.style.height), before);
    assert.deepEqual(viewport.getBoundingClientRect(), originalBox);
    assert.deepEqual(h.read(), saved);
  }
  assert.equal(frame.src, originalSource);
  h.bridge.destroy();
});

test('phone ignores shared PC layout while touch laptops and explicit preview layout retain their choices', async () => {
  const saved = { livingJapanSettings: {}, livingJapanUIPreferences: {}, extensionUi: { layout: 'desktop' }, customSlots: {} };
  const phone = await host(980, 820, 700, saved, { touch: true, screen: { width: 390, height: 844 } });
  assert.equal(phone.shell.dataset.layout, 'mobile');
  assert.equal(phone.read().extensionUi.layout, 'desktop', 'opening on a phone does not rewrite another device preference');
  await phone.bridge.setLayout('portrait'); assert.equal(phone.shell.dataset.layout, 'portrait', 'isolated preview keeps explicit layout controls');
  phone.bridge.destroy();
  const laptop = await host(1280, 800, 680, saved, { touch: true, screen: { width: 1280, height: 800 } });
  assert.equal(laptop.shell.dataset.layout, 'desktop'); laptop.bridge.destroy();
  saved.extensionUi.layout = 'portrait';
  const realPhone = await host(390, 844, 732, saved, { touch: true });
  realPhone.document.getElementById('previewStatus').id = '';
  assert.equal(realPhone.shell.dataset.layout, 'mobile');
  assert.equal(await realPhone.bridge.setLayout('desktop'), false, 'real host cannot override fixed phone layout');
  assert.equal(realPhone.read().extensionUi.layout, 'portrait');
  const drag = windowDrag(realPhone), original = realPhone.document.getElementById('living-japan-viewport').getBoundingClientRect();
  drag.moveTo(100, 100);
  assert.deepEqual(realPhone.document.getElementById('living-japan-viewport').getBoundingClientRect(), original);
  for (const id of ['living-japan-resize', 'living-japan-resize-right', 'living-japan-resize-bottom']) assert.equal(realPhone.document.getElementById(id).hidden, true);
  realPhone.bridge.destroy();
});

test('mobile exposes two textarea lines above a bottom toolbar and keeps its canvas while the keyboard translates it', async () => {
  const h = await host(390, 844, 732, null, { touch: true });
  const viewport = h.document.getElementById('living-japan-viewport'), textarea = h.document.getElementById('send_textarea'), frame = h.shell.children[0];
  const source = frame.src, saved = structuredClone(h.read()), original = viewport.getBoundingClientRect();
  assert.equal(original.bottom, 756, 'textarea bottom 804 minus 48px exposes textarea itself, plus its 40px toolbar');
  assert.equal(original.width, 390);
  textarea.rect.top = 400; textarea.rect.height = 404; h.inputResize();
  assert.deepEqual(viewport.getBoundingClientRect(), original, 'growing textarea keeps its bottom and does not shrink mobile');
  h.document.activeElement = textarea;
  textarea.rect.bottom = 464;
  h.visualResize({ height: 504 });
  const raised = viewport.getBoundingClientRect();
  assert.equal(raised.height, original.height); assert.equal(raised.top, -340); assert.equal(raised.bottom, 416);
  h.document.activeElement = null; h.visualResize({ height: 520 });
  assert.equal(viewport.getBoundingClientRect().height, original.height, 'blur before keyboard animation ends does not overwrite its resting size');
  textarea.rect.bottom = 804; h.visualResize({ height: 844 });
  assert.deepEqual(viewport.getBoundingClientRect(), original);
  h.document.activeElement = frame; frame.contentDocument.activeElement = h.document.createElement('input');
  textarea.rect.bottom = 464; h.visualResize({ height: 504 });
  assert.equal(viewport.getBoundingClientRect().top, -340, 'iframe input focus also detects keyboard');
  frame.contentDocument.activeElement = { tagName: 'DIV', isContentEditable: true };
  h.visualResize({ height: 504 }); assert.equal(viewport.getBoundingClientRect().top, -340);
  assert.equal(frame.src, source); assert.deepEqual(h.read(), saved);
  assert.equal(h.document.getElementById('living-japan-resize').hidden, true);
  h.bridge.destroy();
});

test('mobile address bar changes are not keyboard shifts and rotation resets the fill dimensions', async () => {
  const h = await host(390, 844, 732, null, { touch: true });
  const viewport = h.document.getElementById('living-japan-viewport'), textarea = h.document.getElementById('send_textarea');
  textarea.rect.bottom = 764; h.visualResize({ height: 804 });
  assert.equal(viewport.getBoundingClientRect().top, 0);
  assert.equal(viewport.getBoundingClientRect().height, 716);
  h.window.innerWidth = 844; h.window.innerHeight = 390;
  textarea.rect.bottom = 350; h.resize();
  assert.equal(h.shell.dataset.layout, 'mobile');
  assert.equal(viewport.getBoundingClientRect().width, 844);
  assert.equal(viewport.getBoundingClientRect().height, 302);
  assert.equal(viewport.getBoundingClientRect().top, 0);
  h.bridge.destroy();
});

test('gradual keyboard animation retains the original mobile canvas instead of ratcheting its baseline smaller', async () => {
  const h = await host(390, 844, 732, null, { touch: true });
  const viewport = h.document.getElementById('living-japan-viewport'), textarea = h.document.getElementById('send_textarea');
  const original = viewport.getBoundingClientRect(); h.document.activeElement = textarea;
  for (let height = 804; height >= 524; height -= 40) {
    textarea.rect.bottom = height - 40; h.visualResize({ height });
    assert.equal(viewport.getBoundingClientRect().height, original.height, `opening at ${height}px retains the canvas`);
    assert.equal(viewport.getBoundingClientRect().top, height - 844);
  }
  assert.equal(viewport.getBoundingClientRect().height, original.height);
  assert.equal(viewport.getBoundingClientRect().top, -320);
  h.document.activeElement = null;
  for (let height = 564; height <= 844; height += 40) {
    textarea.rect.bottom = height - 40; h.visualResize({ height });
    assert.equal(viewport.getBoundingClientRect().height, original.height, `closing at ${height}px retains the canvas`);
    assert.equal(viewport.getBoundingClientRect().top, height - 844);
  }
  assert.deepEqual(viewport.getBoundingClientRect(), original);
  h.bridge.destroy();
});

test('resize controls are invisible inside edges and cannot take the top toolbar hit area', async () => {
  const h = await host(1600, 1000);
  const corner = h.document.getElementById('living-japan-resize');
  const right = h.document.getElementById('living-japan-resize-right'), bottom = h.document.getElementById('living-japan-resize-bottom');
  assert.equal(corner.textContent || '', ''); assert.ok(right); assert.ok(bottom);
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /padding:4px 28px/);
  assert.match(css, /\[data-resize-edge="right"\][^{]*\{[^}]*top:44px/);
  right.fire('pointerdown', { pointerId: 1, clientX: 1500, clientY: 500 });
  right.fire('pointermove', { pointerId: 1, clientX: 0, clientY: 500 });
  right.fire('pointerup', { pointerId: 1 });
  assert.equal(parseFloat(h.shell.style.height), 600);
  bottom.fire('pointerdown', { pointerId: 2, clientX: 600, clientY: 600 });
  bottom.fire('pointermove', { pointerId: 2, clientX: 600, clientY: 640 });
  bottom.fire('pointerup', { pointerId: 2 });
  assert.equal(parseFloat(h.shell.style.height), 640);
  h.bridge.destroy();
});

test('large scaled CSS viewports keep the approved shape and respect visible viewport offsets', async () => {
  const h = await host(2194, 1234, 1114);
  h.window.devicePixelRatio = 1.75;
  const frame = h.shell.children.find(node => node.tag === 'iframe'), originalSource = frame.src;
  assert.equal(parseFloat(h.shell.style.height), 1226);
  assert.ok(Math.abs(parseFloat(h.shell.style.width) - 1961.6) < 0.001);
  h.window.visualViewport = { width: 1800, height: 1040, offsetLeft: 12, offsetTop: 20, removeEventListener() {} };
  h.resize();
  const viewport = h.document.getElementById('living-japan-viewport');
  assert.equal(parseFloat(h.shell.style.height), 1032);
  assert.ok(Math.abs(parseFloat(h.shell.style.width) - 1651.2) < 0.001);
  assert.equal(parseFloat(viewport.style.top), 20);
  assert.ok(parseFloat(viewport.style.left) >= 12);
  h.document.getElementById('send_textarea').rect.top = 960; h.inputResize();
  assert.equal(parseFloat(h.shell.style.height), 1032);
  assert.equal(parseFloat(viewport.style.top) + parseFloat(viewport.style.height), 1060);
  assert.equal(frame.src, originalSource);
  h.bridge.destroy();
});

test('corner resizing preserves the frame and minimum size, and double click restores fit', async () => {
  const h = await host(1600, 1000, 880);
  const handle = h.document.getElementById('living-japan-resize');
  assert.ok(handle, 'the workspace has an invisible corner target');
  assert.equal(h.shell.contains(handle), false, 'edge target overlays the outer frame without belonging to iframe content');
  const frame = h.shell.children.find(node => node.tag === 'iframe'), originalSource = frame.src;
  const fittedWidth = parseFloat(h.shell.style.width);
  handle.fire('pointerdown', { pointerId: 1, clientX: 1500, clientY: 800 });
  handle.fire('pointermove', { pointerId: 1, clientX: 0, clientY: 0 });
  handle.fire('pointerup', { pointerId: 1 });
  assert.equal(parseFloat(h.shell.style.width), 960);
  assert.equal(parseFloat(h.shell.style.height), 600);
  handle.fire('keydown', { key: 'ArrowRight' });
  assert.equal(parseFloat(h.shell.style.width), 992);
  assert.equal(parseFloat(h.shell.style.height), 620);
  assert.equal(frame.src, originalSource);
  handle.fire('dblclick');
  assert.equal(parseFloat(h.shell.style.width), fittedWidth);
  assert.equal(parseFloat(h.shell.style.height), 992);
  assert.ok(Math.abs(parseFloat(h.shell.style.width) / parseFloat(h.shell.style.height) - 8 / 5) < 0.001);
  assert.equal(frame.src, originalSource);
  h.bridge.destroy();
});

test('a notebook portrait has its full minimum height before outer scrolling is needed', async () => {
  const h = await host(1366, 768, 648);
  await h.bridge.setLayout('portrait');
  const scroll = h.document.getElementById('living-japan-scroll');
  assert.ok(scroll, 'small browser windows retain a scrolling workspace');
  assert.equal(parseFloat(h.shell.style.height), 760);
  assert.equal(parseFloat(scroll.style.height), 760);
  assert.equal(parseFloat(scroll.style.width), 380);
  const viewport = h.document.getElementById('living-japan-viewport');
  assert.equal(parseFloat(viewport.style.height), 768);
  assert.equal(parseFloat(viewport.style.width), 388);
  h.bridge.destroy();
});

test('portrait shrinks its original canvas but expands the content area after reaching its original control size', async () => {
  const h = await host(1366, 768, 648);
  await h.bridge.setLayout('portrait');
  const frame = h.shell.children.find(node => node.tag === 'iframe'), source = frame.src;
  assert.equal(frame.style.width, '430px'); assert.equal(frame.style.height, '860px');
  const scale = () => Number(frame.style.transform.match(/scale\(([^)]+)\)/)?.[1]);
  assert.ok(Math.abs(scale() - 378 / 430) < 0.000001);
  h.window.innerHeight = 1000; h.document.getElementById('send_textarea').rect.top = 880; h.resize();
  assert.equal(scale(), 1); assert.equal(frame.style.width, '494px'); assert.equal(frame.style.height, '990px'); assert.equal(frame.src, source);
  await h.bridge.setLayout('desktop'); assert.equal(frame.style.transform, ''); assert.equal(frame.style.width, '');
  h.bridge.destroy();
});

test('mobile keeps its flexible height while narrow screens scale down and wider screens add content area', async () => {
  const h = await host(360, 760, 640);
  const frame = h.shell.children.find(node => node.tag === 'iframe'), source = frame.src;
  const scale = () => Number(frame.style.transform?.match(/scale\(([^)]+)\)/)?.[1]);
  assert.equal(frame.style.width, '430px');
  assert.ok(Math.abs(scale() - 0.8325581395) < 0.000001);
  assert.ok(Math.abs(parseFloat(frame.style.height) * scale() - 662) < 0.000001);
  h.window.innerWidth = 600; h.resize();
  assert.equal(scale(), 1); assert.equal(frame.style.width, '598px'); assert.equal(frame.style.height, '662px'); assert.equal(frame.src, source);
  await h.bridge.setLayout('desktop'); assert.equal(frame.style.transform, ''); assert.equal(frame.style.height, '');
  h.bridge.destroy();
});

function windowDrag(h) {
  const handle = h.document.createElement('header'), frame = h.shell.children[0];
  const unmount = h.bridge.mountWindowDrag?.(handle);
  function point(name, x, y, values = {}) {
    const rect = frame.getBoundingClientRect();
    handle.fire(name, { pointerId: 7, button: 0, clientX: (x - rect.left) * frame.clientWidth / rect.width,
      clientY: (y - rect.top) * frame.clientHeight / rect.height, ...values });
  }
  function moveTo(x, y) {
    const box = h.document.getElementById('living-japan-viewport').getBoundingClientRect();
    const start = frame.getBoundingClientRect();
    point('pointerdown', start.left + 10, start.top + 10);
    point('pointermove', start.left + 10 + x - box.left, start.top + 10 + y - box.top);
    point('pointerup', start.left + 10 + x - box.left, start.top + 10 + y - box.top);
  }
  return { handle, point, moveTo, unmount };
}

test('scaled portrait title dragging uses host coordinates and ignores toolbar buttons', async () => {
  const h = await host(1600, 1100, 980);
  await h.bridge.setLayout('portrait');
  const size = h.document.getElementById('living-japan-resize');
  size.fire('pointerdown', { pointerId: 1, clientX: 800, clientY: 900 });
  size.fire('pointermove', { pointerId: 1, clientX: -500, clientY: -500 });
  size.fire('pointerup', { pointerId: 1 });
  const drag = windowDrag(h), viewport = h.document.getElementById('living-japan-viewport');
  drag.moveTo(120, 70);
  assert.equal(parseFloat(viewport.style.left), 120);
  assert.equal(parseFloat(viewport.style.top), 70);
  assert.equal(parseFloat(h.shell.style.width), 320);
  const button = h.document.createElement('button');
  drag.point('pointerdown', 140, 90, { target: button });
  drag.point('pointermove', 500, 500);
  drag.point('pointerup', 500, 500);
  assert.equal(parseFloat(viewport.style.left), 120, 'a toolbar click cannot start window dragging');
  drag.moveTo(180, 110);
  assert.equal(parseFloat(viewport.style.left), 180, 'a second gesture uses the relocated iframe origin');
  const frameBox = h.shell.children[0].getBoundingClientRect();
  drag.point('pointerdown', frameBox.left + 10, frameBox.top + 10);
  drag.point('pointermove', frameBox.left + 40, frameBox.top + 30);
  drag.point('pointermove', frameBox.left + 60, frameBox.top + 50);
  drag.point('pointercancel', frameBox.left + 60, frameBox.top + 50);
  assert.equal(parseFloat(viewport.style.left), 230, 'successive captured events use the moving iframe origin');
  assert.equal(parseFloat(viewport.style.top), 150);
  await h.bridge.close();
  h.bridge.destroy();
});

test('horizontal and vertical geometry survives close, layout switches, and a fresh app instance', async () => {
  const h = await host(1600, 1100, 980);
  const size = h.document.getElementById('living-japan-resize');
  function shrink() {
    size.fire('pointerdown', { pointerId: 2, clientX: 1000, clientY: 900 });
    size.fire('pointermove', { pointerId: 2, clientX: -1000, clientY: -1000 });
    size.fire('pointerup', { pointerId: 2 });
  }
  shrink();
  windowDrag(h).moveTo(80, 90);
  await h.bridge.close(); await h.bridge.open();
  const viewport = h.document.getElementById('living-japan-viewport');
  assert.equal(parseFloat(viewport.style.left), 80);
  assert.equal(parseFloat(viewport.style.top), 90);
  await h.bridge.setLayout('portrait'); shrink(); windowDrag(h).moveTo(400, 30);
  await h.bridge.close();
  const saved = structuredClone(h.read()); h.bridge.destroy();
  assert.deepEqual(saved.livingJapanUIPreferences.panelGeometry, {
    horizontal: { x: 80, y: 90, width: 960, height: 600 },
    vertical: { x: 400, y: 30, width: 320, height: 640 },
  });
  const reloaded = await host(1600, 1100, 980, saved), outer = reloaded.document.getElementById('living-japan-viewport');
  assert.equal(parseFloat(outer.style.left), 400); assert.equal(parseFloat(outer.style.top), 30);
  assert.equal(parseFloat(reloaded.shell.style.height), 640);
  await reloaded.bridge.setLayout('desktop');
  assert.equal(parseFloat(outer.style.left), 80); assert.equal(parseFloat(outer.style.top), 90);
  assert.equal(parseFloat(reloaded.shell.style.height), 600);
  reloaded.bridge.destroy();
});

test('the complete visible frame stays inside all four walls, including small and shifted viewports', async () => {
  const h = await host(1600, 1100, 980);
  await h.bridge.setLayout('portrait');
  const viewport = h.document.getElementById('living-japan-viewport'), drag = windowDrag(h);
  drag.moveTo(-5000, -5000);
  assert.equal(parseFloat(viewport.style.left), 0); assert.equal(parseFloat(viewport.style.top), 0);
  drag.moveTo(5000, 5000);
  let box = viewport.getBoundingClientRect();
  assert.equal(box.right, 1600); assert.equal(box.bottom, 1100);
  h.window.visualViewport = { width: 280, height: 500, offsetLeft: 20, offsetTop: 30, removeEventListener() {} };
  h.document.getElementById('send_textarea').rect.top = 450; h.resize();
  box = viewport.getBoundingClientRect();
  assert.equal(box.left, 20); assert.equal(box.top, 30); assert.equal(box.right, 300); assert.equal(box.bottom, 530);
  assert.equal(parseFloat(h.shell.style.width), 320); assert.equal(parseFloat(h.shell.style.height), 640);
  drag.moveTo(8000, -8000); box = viewport.getBoundingClientRect();
  assert.equal(box.left, 20); assert.equal(box.top, 30);
  await h.bridge.close(); await h.bridge.open(); box = viewport.getBoundingClientRect();
  assert.equal(box.left, 20); assert.equal(box.bottom, 530);
  h.bridge.destroy();
});

test('resizing saves effective bounded dimensions and restore-fit clears only the active geometry', async () => {
  const saved = { livingJapanSettings: {}, customSlots: {}, extensionUi: { layout: 'desktop' }, livingJapanUIPreferences: {
    panelGeometry: { horizontal: { x: 99999, y: -99999, width: 960, height: 600 }, vertical: { x: 40, y: 30, width: 320, height: 640 } },
  } };
  const h = await host(1600, 1100, 980, saved), size = h.document.getElementById('living-japan-resize');
  const viewport = h.document.getElementById('living-japan-viewport');
  assert.equal(viewport.getBoundingClientRect().right, 1600); assert.equal(viewport.getBoundingClientRect().top, 0);
  size.fire('pointerdown', { pointerId: 3, clientX: 1500, clientY: 800 });
  size.fire('pointermove', { pointerId: 3, clientX: 9000, clientY: 9000 });
  size.fire('pointerup', { pointerId: 3 });
  await h.bridge.close();
  const geometry = h.read().livingJapanUIPreferences.panelGeometry.horizontal;
  assert.equal(geometry.height, 995); assert.ok(Math.abs(geometry.width - 1592) < 0.001);
  assert.equal(viewport.getBoundingClientRect().right, 1600); assert.ok(viewport.getBoundingClientRect().bottom <= 1100);
  size.fire('dblclick'); await h.bridge.close();
  assert.equal(h.read().livingJapanUIPreferences.panelGeometry.horizontal, null);
  assert.equal(h.read().livingJapanUIPreferences.panelGeometry.vertical.x, 40);
  h.bridge.destroy();
});
