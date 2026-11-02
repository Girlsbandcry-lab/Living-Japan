import test from 'node:test';
import assert from 'node:assert/strict';
import { createNationalMap } from '../src/national-map.js';
import { createCatalog } from '../src/catalog.js';

function host(width = 800, height = 500) {
  const size = { width, height }, handlers = new Map(), strokes = [];
  const context = new Proxy({}, { get(_, key) {
    if (key === 'measureText') return () => ({ width: 20 });
    if (key === 'clearRect') return () => { strokes.length = 0; };
    if (key === 'stroke') return path => { if (path?.d) strokes.push(path.d); };
    return () => {};
  }, set() { return true; } });
  const rect = () => ({ left: 0, top: 0, ...size });
  const canvas = { style: {}, dataset: {}, setAttribute() {}, getContext: () => context, getBoundingClientRect: rect,
    addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener() {}, setPointerCapture() {}, releasePointerCapture() {}, remove() {} };
  return { size, handlers, strokes, container: { style: {}, ownerDocument: { createElement: () => canvas }, appendChild() {}, getBoundingClientRect: rect } };
}
const catalogFixture = () => ({ projection: () => ({}), loadRegion: async code => ({ code, map: { defaultBounds: code === 'metro' ? [-2335.64, -1655.61, 3732.79, 3116.16] : [0, 0, 100, 100], land: [] } }), viewport: async () => ({ entities: [] }) });

test('the first metro view centers Tokyo with Kawasaki visible and Yokohama and Chiba at the edges', async () => {
  const h = host(), map = createNationalMap(h.container, { catalog: catalogFixture() });
  try {
    await map.setRegion('metro');
    const view = map.getView();
    const longitude = (view.center[0] + 387620.77883498045) / 2777.7475010476232;
    const latitude = (view.center[1] - 122412.75850988968) / -3418.872828117987;
    assert.ok(longitude > 139.72 && longitude < 139.78, 'Tokyo urban center is the visual subject');
    assert.ok(latitude > 35.65 && latitude < 35.71);
    assert.ok(800 / view.scale > 2100 && 800 / view.scale < 2500, 'the view shows nearby city edges rather than complete cities');
  } finally { map.destroy(); }
});

test('wheel and drag immediately publish a restorable view without moving its center on reconstruction', async () => {
  const h = host(), views = [], catalog = catalogFixture();
  const map = createNationalMap(h.container, { catalog, onViewChange: view => views.push(view) });
  let restored;
  try {
    await map.setRegion('13');
    h.handlers.get('wheel')({ clientX: 400, clientY: 250, deltaY: -1, preventDefault() {} });
    h.handlers.get('pointerdown')({ pointerId: 1, clientX: 400, clientY: 250 });
    h.handlers.get('pointermove')({ pointerId: 1, clientX: 450, clientY: 270 });
    h.handlers.get('pointerup')({ pointerId: 1, clientX: 450, clientY: 270, type: 'pointerup' });
    assert.deepEqual(views.at(-1), map.getView());
    const snapshot = map.getView();
    restored = createNationalMap(host(320, 319).container, { catalog });
    await restored.setRegion(snapshot.regionCode); await restored.setView(snapshot);
    assert.deepEqual(restored.getView().center, snapshot.center);
    assert.equal(restored.getView().scale, snapshot.scale);
  } finally { map.destroy(); restored?.destroy(); }
});

test('initial fitting waits for a visible map and hiding a page does not corrupt its viewport', async () => {
  const Original = globalThis.ResizeObserver; let resized;
  globalThis.ResizeObserver = class { constructor(fn) { resized = fn; } observe() {} disconnect() {} };
  const h = host(0, 0), map = createNationalMap(h.container, { catalog: catalogFixture() });
  try {
    await map.setRegion('13'); h.size.width = 800; h.size.height = 500; resized();
    assert.ok(Math.abs(map.getView().scale - 4.6) < 0.000001);
    map.zoom(1); const previous = map.getView();
    h.size.width = h.size.height = 0; resized();
    h.size.width = 800; h.size.height = 500; resized();
    assert.deepEqual(map.getView().center, previous.center); assert.equal(map.getView().scale, previous.scale);
  } finally { map.destroy(); globalThis.ResizeObserver = Original; }
});

test('administrative geometry uses official area codes and a unique complete city relation', async () => {
  const wardPath = 'M10,10L20,10L20,20Z', cityPath = 'M9,9L31,9L31,31ZM12,12L13,12L13,13Z';
  const nodes = [
    { id: 'pref', nameJa: '東京都', kind: 'prefecture', regionCode: '13', officialCode: '13', adminPath: [] },
    { id: 'city', nameJa: '試験市', kind: 'city', regionCode: '13', parentId: 'pref', adminPath: ['pref'] },
    { id: 'ward', nameJa: '中央区', kind: 'ward', regionCode: '13', officialCode: '13101', parentId: 'city', adminPath: ['pref', 'city'] },
    { id: 'ward2', nameJa: '北区', kind: 'ward', regionCode: '13', officialCode: '13102', parentId: 'city', adminPath: ['pref', 'city'] },
  ];
  const index = { adminNodes: nodes, regions: [{ code: '13', mapPath: 'region.json', overlayParts: [{ path: 'outlines.json', level: 'detail', bounds: [0, 0, 100, 100] }] }] };
  const data = { 'manifest.json': index, 'region.json': { region: { defaultBounds: [0, 0, 100, 100] }, geo: { land: [{ code: '13101', n: '中央区', b: [10, 10, 20, 20], d: wardPath }, { code: '13102', n: '北区', b: [20, 20, 30, 30], d: 'M20,20L30,20L30,30Z' }] }, transport: {} },
    'outlines.json': { boundaries: [{ id: 'city-shape', n: '試験市', adminLevel: 7, b: [9, 9, 31, 31], d: cityPath }, { id: 'same-name-elsewhere', n: '試験市', adminLevel: 7, b: [400, 400, 500, 500], d: 'M400,400L500,400L500,500Z' }, { id: 'pref-shape', n: '東京', adminLevel: 4, b: [0, 0, 100, 100], d: 'M0,0L100,0L100,100Z' }] } };
  const catalog = createCatalog({ useWorker: false, baseUrl: 'https://example.invalid/', fetcher: async url => new Response(JSON.stringify(data[String(url).split('/').pop()])) });
  try {
    await catalog.loadIndex(); assert.equal(typeof catalog.adminBoundary, 'function');
    const ward = await catalog.adminBoundary('ward'); assert.equal(ward.d, wardPath); assert.deepEqual(ward.b, [10, 10, 20, 20]);
    const city = await catalog.adminBoundary('city'); assert.equal(city.d, cityPath); assert.deepEqual(city.b, [9, 9, 31, 31]);
    const prefecture = await catalog.adminBoundary('pref'); assert.ok(prefecture); assert.equal(prefecture.sourceId, 'pref-shape');
    assert.equal(await catalog.adminBoundary('missing'), null);
  } finally { catalog.destroy(); }
});

test('locating an administrative area draws its real outline, restores it, and point location clears it', async () => {
  const Original = globalThis.Path2D; globalThis.Path2D = class { constructor(d) { this.d = d; } };
  const h = host(), outline = { id: 'ward', b: [20, 30, 60, 70], d: 'M20,30L60,30L60,70Z' };
  const catalog = { ...catalogFixture(), adminBoundary: async id => id === 'ward' ? outline : null };
  const map = createNationalMap(h.container, { catalog }); let restored;
  try {
    await map.setRegion('13'); await map.locate({ id: 'ward', type: '行政区', kind: 'ward', regionCode: '13' });
    assert.deepEqual(map.getView().center, [40, 50]); assert.equal(map.getView().outlineId, 'ward');
    await new Promise(resolve => setTimeout(resolve, 25)); assert(h.strokes.includes(outline.d));
    restored = createNationalMap(host().container, { catalog }); await restored.setView(map.getView());
    assert.equal(restored.getView().outlineId, 'ward');
    await map.locate({ id: 'point', coordinates: { x: 45, y: 55 }, regionCode: '13' });
    assert.equal(map.getView().outlineId, null);
  } finally { map.destroy(); restored?.destroy(); globalThis.Path2D = Original; }
});
