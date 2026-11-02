import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createRegionPackManager, createPackResourceFetcher } from '../src/region-pack-manager.js';
import { packSha256 } from '../src/region-pack-resources.js';

const sha = value => createHash('sha256').update(value).digest('hex');
const registryUrl = '/user/files/living-japan-region-packs.json';
function fixture() {
  const remote = new Map(), host = new Map(), calls = [], failed = new Set();
  const catalog = { schemaVersion: 1, version: 'v1', packages: [] };
  function pack(id, version, resourceSets, dependencies = []) {
    const manifest = { schemaVersion: 1, id, version, regionCodes: ['13'], dependencies, chunks: [], files: {}, nationalManifestFragment: { regions: [] } };
    resourceSets.forEach((files, number) => {
      const data = Buffer.from(gzipSync(JSON.stringify({ schemaVersion: 1, files: Object.fromEntries(Object.entries(files).map(([path, bytes]) => [path, Buffer.from(bytes).toString('base64')])) })));
      const chunk = { id: String(number), url: `chunk-${number}.gz`, bytes: data.length, sha256: sha(data) };
      manifest.chunks.push(chunk); remote.set(`https://packs.test/${id}/${version}/${chunk.url}`, data);
      for (const [path, bytes] of Object.entries(files)) manifest.files[path] = { chunkId: chunk.id, bytes: bytes.length, sha256: sha(bytes) };
    });
    manifest.contentSha256 = sha(JSON.stringify({dependencies,files:manifest.files}));
    const entry = { id, name: id, version, contentSha256:manifest.contentSha256, manifestUrl: `${id}/${version}/manifest.json`, downloadBytes: manifest.chunks.reduce((n, c) => n + c.bytes, 0), chunks: manifest.chunks.map(({sha256, bytes}) => ({sha256, bytes})), regionCodes: ['13'], dependencies };
    catalog.packages = [...catalog.packages.filter(p => p.id !== id), entry];
    remote.set(`https://packs.test/${entry.manifestUrl}`, manifest);
    return manifest;
  }
  let hook;
  const fetcher = async (input, options = {}) => {
    const url = String(input); calls.push({ url, method: options.method || 'GET' });
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (hook) { const result = await hook(url, options); if (result) return result; }
    if (failed.has(url)) return new Response('failure', { status: 503 });
    if (url === 'https://packs.test/catalog.json') return Response.json(catalog);
    if (url === '/api/files/upload') {
      const body = JSON.parse(options.body); host.set('/user/files/' + body.name, Buffer.from(body.data, 'base64'));
      return Response.json({ path: 'user/files/' + body.name });
    }
    if (url === '/api/files/delete') { host.delete('/' + JSON.parse(options.body).path.replace(/^\//, '')); return new Response(null, { status: 200 }); }
    if (host.has(url)) return new Response(host.get(url));
    if (remote.has(url)) { const data = remote.get(url); return Buffer.isBuffer(data) ? new Response(data) : Response.json(data); }
    return new Response(null, { status: 404 });
  };
  const manager = () => createRegionPackManager({ sourceUrl: 'https://packs.test/catalog.json', fetcher, requestHeaders: () => ({ 'X-CSRF-Token': 'fixture' }) });
  return { pack, manager, fetcher, host, remote, catalog, calls, failed, setHook(fn) { hook = fn; } };
}

test('first install downloads dependency, reports measured bytes and enables only after save confirmation', async () => {
  const f = fixture();
  f.pack('common', '1', [{ 'data/common.json': Buffer.from('{"common":true}') }]);
  f.pack('metro', '1', [{ 'data/metro.json.gz': gzipSync('{"metro":true}') }], ['common']);
  const m = f.manager(); await m.load(); const events = []; m.subscribe(s => events.push(s));
  f.setHook((url, options) => { if (url === '/api/files/upload' && JSON.parse(options.body).name.startsWith('living-japan-pack-')) assert.equal(m.getActiveSnapshot().manifests.some(x => x.id === 'metro'), false); });
  await m.install('metro');
  assert.deepEqual(m.getActiveSnapshot().manifests.map(x => x.id), ['common', 'metro']);
  assert.equal(m.getState().operation.phase, 'ready');
  assert.equal(m.getState().operation.receivedBytes, m.getState().operation.totalBytes);
  assert.ok(events.some(s => s.operation?.phase === 'downloading' && s.operation.receivedBytes > 0));
  assert.ok(events.some(s => s.operation?.phase === 'saving'));
  assert.ok(f.calls.every(c => !c.url.includes('living-japan-user-data') && !c.url.includes('/api/extensions/')));
  const reopened = f.manager(); await reopened.load(); assert.deepEqual(reopened.getActiveSnapshot(), m.getActiveSnapshot());
  assert.equal(reopened.getState().setupComplete, true);
  await assert.rejects(reopened.setEnabled('metro', false), /首都圈/);
  await assert.rejects(reopened.remove('metro'), /首都圈/);
  assert.equal(reopened.getState().ready, true);
});

test('interrupted install retains verified first block and retries only unfinished block', async () => {
  const f = fixture(); f.pack('metro', '1', [{ 'data/a.json': Buffer.from('A') }, { 'data/b.json': Buffer.from('B') }]);
  const second = 'https://packs.test/metro/1/chunk-1.gz'; f.failed.add(second);
  const m = f.manager(); await m.load(); await assert.rejects(m.install('metro'), /503/);
  assert.equal(m.getActiveSnapshot().manifests.length, 0);
  const reopened = f.manager(); await reopened.load(); f.failed.clear(); await reopened.install('metro');
  assert.equal(f.calls.filter(c => c.url === 'https://packs.test/metro/1/chunk-0.gz').length, 1);
  assert.equal(f.calls.filter(c => c.url === second).length, 2);
  assert.equal(f.calls.filter(c => c.url === '/api/files/upload').length, 5);
});

test('failed update keeps old active version; successful update preserves a disabled package', async () => {
  const f = fixture(); f.pack('other', '1', [{ 'data/other.json': Buffer.from('old') }]);
  const m = f.manager(); await m.load(); await m.install('other'); await m.setEnabled('other', true);
  f.pack('other', '2', [{ 'data/other.json': Buffer.from('new') }]); await m.refreshCatalog();
  f.failed.add('https://packs.test/other/2/chunk-0.gz'); await assert.rejects(m.install('other'), /503/);
  assert.equal(m.getActiveSnapshot().manifests[0].version, '1');
  await m.setEnabled('other', false); f.failed.clear(); await m.install('other');
  assert.equal(m.getState().packages.other.installed.version, '2');
  assert.equal(m.getState().packages.other.enabled, false);
  assert.equal(m.getActiveSnapshot().manifests.length, 0);
});

test('shared chunk is uploaded once and survives removal while another installed package references it', async () => {
  const f = fixture(), files = { 'data/shared.json': Buffer.from('shared') };
  f.pack('a', '1', [files]); f.pack('b', '1', [files]);
  const m = f.manager(); await m.load(); await m.install('a'); await m.install('b');
  const blobs = () => [...f.host.keys()].filter(k => k.includes('living-japan-pack-'));
  assert.equal(blobs().length, 1); await m.remove('a'); assert.equal(blobs().length, 1);
  await m.remove('b'); assert.equal(blobs().length, 0);
});

test('shared blocks referenced by an interrupted install survive removal of their installed owner', async () => {
  const f = fixture(), shared = { 'data/shared.json': Buffer.from('shared') };
  f.pack('a', '1', [shared]); f.pack('b', '1', [shared, { 'data/b.json': Buffer.from('B') }]);
  const m = f.manager(); await m.load(); await m.install('a'); await m.setEnabled('a', true);
  f.failed.add('https://packs.test/b/1/chunk-1.gz'); await assert.rejects(m.install('b'), /503/);
  const sharedUrl = m.getActiveSnapshot().files['data/shared.json'].url;
  await m.remove('a'); assert.ok(f.host.has(sharedUrl));
  await m.remove('b'); assert.equal(f.host.has(sharedUrl), false);
});

test('committed removal survives cleanup failure and retries later without changing personal files', async () => {
  const f = fixture(); f.pack('a', '1', [{ 'data/a.json': Buffer.from('a') }]);
  f.pack('other', '1', [{ 'data/other.json': Buffer.from('other') }]);
  const personalUrl = '/user/files/living-japan-user-data.json', personal = Buffer.from('{"draft":"个人稿"}');
  f.host.set(personalUrl, personal);
  const m = f.manager(); await m.load(); await m.install('a'); await m.setEnabled('a', true);
  const blockUrl = m.getActiveSnapshot().files['data/a.json'].url;
  f.failed.add('/api/files/delete'); const result = await m.remove('a');
  assert.match(result.operation.cleanupError, /503/);
  assert.equal(result.packages.a, undefined); assert.deepEqual(m.getActiveSnapshot().files, {});
  assert.ok(f.host.has(blockUrl)); assert.deepEqual(f.host.get(personalUrl), personal);
  const reopened = f.manager(); await reopened.load(); assert.deepEqual(reopened.getActiveSnapshot().files, {});
  f.failed.clear(); await reopened.install('other');
  assert.equal(reopened.getState().operation.cleanupError, null); assert.equal(f.host.has(blockUrl), false);
  assert.deepEqual(reopened.getActiveSnapshot().activePackIds, []); assert.equal(reopened.getState().packages.other.enabled, false);
  assert.deepEqual(f.host.get(personalUrl), personal);
});

test('reused blocks still validate newly declared file hashes before completing an update', async () => {
  const f = fixture(), files = { 'data/shared.json': Buffer.from('shared') };
  f.pack('metro', '1', [files]); const m = f.manager(); await m.load(); await m.install('metro');
  const update = f.pack('metro', '2', [files]); update.files['data/shared.json'].sha256 = sha('wrong');
  await m.refreshCatalog(); await assert.rejects(m.install('metro'), /校验/);
  assert.equal(m.getState().packages.metro.installed.version, '1');
  assert.equal(f.calls.some(c => c.url === 'https://packs.test/metro/2/chunk-0.gz'), false);
});

test('conflicting active resources cannot replace the previous installed version', async () => {
  const f = fixture(), shared = { 'data/shared.json': Buffer.from('shared') };
  f.pack('a', '1', [shared]); f.pack('b', '1', [shared]);
  const m = f.manager(); await m.load(); await m.install('a'); await m.install('b'); await m.setEnabled('a', true); await m.setEnabled('b', true);
  f.pack('b', '2', [{ 'data/shared.json': Buffer.from('different') }]); await m.refreshCatalog();
  await assert.rejects(m.install('b'), /同路径资源/);
  assert.equal(m.getState().packages.b.installed.version, '1');
  assert.equal(m.getActiveSnapshot().files['data/shared.json'].sha256, sha('shared'));
});

test('corrupt registry is an error and is never treated as first install', async () => {
  const f = fixture(); f.host.set(registryUrl, Buffer.from('{broken'));
  const m = f.manager(); await assert.rejects(m.load(), /安装记录/);
  await assert.rejects(m.install('metro'), /读取/);
  assert.equal(f.calls.some(c => c.method === 'POST'), false);
});

test('corrupt host readback cannot enable a downloaded package', async () => {
  const f = fixture(); f.pack('metro', '1', [{ 'data/a.json': Buffer.from('A') }]);
  f.setHook(url => url.startsWith('/user/files/living-japan-pack-') ? new Response('corrupt') : undefined);
  const m = f.manager(); await m.load(); await assert.rejects(m.install('metro'), /校验/);
  assert.equal(m.getActiveSnapshot().manifests.length, 0);
});

test('cancel records a retryable pause without enabling an incomplete package', async () => {
  const f = fixture(); f.pack('metro', '1', [{ 'data/a.json': Buffer.from('A') }]);
  let started; const waiting = new Promise(resolve => { started = resolve; });
  f.setHook((url, options) => url.endsWith('chunk-0.gz') ? new Promise((resolve, reject) => { started(); options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }); }) : undefined);
  const m = f.manager(); await m.load(); const run = m.install('metro'); await waiting; m.cancel('metro'); await assert.rejects(run, { name: 'AbortError' });
  assert.equal(m.getState().operation.phase, 'paused'); assert.equal(m.getActiveSnapshot().manifests.length, 0);
});

test('resource fetcher restores original gzip and program resources, rejects missing pack data without fallback', async () => {
  const f = fixture(); const raw = gzipSync('{"ok":true}');
  f.pack('metro', '1', [{ 'data/a.json.gz': raw, 'src/metro-name-catalog.js': Buffer.from('export const x=1;'), 'src/legacy/transit-data.json': Buffer.from('{}') }]);
  const m = f.manager(); await m.load(); await m.install('metro');
  const fetcher = createPackResourceFetcher({ snapshot: m.getActiveSnapshot(), baseUrl: 'https://app.test/extensions/Living-Japan/', fetcher: f.fetcher });
  assert.deepEqual(Buffer.from(await (await fetcher('https://app.test/extensions/Living-Japan/data/a.json.gz')).arrayBuffer()), raw);
  assert.equal(await (await fetcher(new URL('src/metro-name-catalog.js', 'https://app.test/extensions/Living-Japan/'))).text(), 'export const x=1;');
  const before = f.calls.length;
  assert.equal((await fetcher('https://app.test/extensions/Living-Japan/data/missing.json')).status, 404);
  assert.equal(f.calls.length, before);
  await fetcher('https://app.test/extensions/Living-Japan/src/app.js'); assert.equal(f.calls.at(-1).url.endsWith('src/app.js'), true);
});

test('resource bundle cache retains no more than three blocks', async () => {
  const f = fixture(); f.pack('metro', '1', Array.from({ length: 4 }, (_, i) => ({ [`data/${i}.json`]: Buffer.from(String(i)) })));
  const m = f.manager(); await m.load(); await m.install('metro');
  const fetcher = createPackResourceFetcher({ snapshot: m.getActiveSnapshot(), baseUrl: 'https://app.test/extensions/Living-Japan/', fetcher: f.fetcher });
  for (let i = 0; i < 4; i++) assert.equal(await (await fetcher(`data/${i}.json`)).text(), String(i));
  assert.equal(fetcher.stats().blocks, 3); assert.ok(fetcher.stats().decodedBytes <= 16 * 1024 * 1024);
  fetcher.clear(); assert.deepEqual(fetcher.stats(), { blocks: 0, decodedBytes: 0 });
});

test('LAN HTTP SHA-256 fallback matches Node for empty, boundary, multi-block and real gzip bundle bytes', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const f = fixture(); f.pack('metro', '1', [{ 'data/place.json': Buffer.from('{"name":"东京"}') }]);
  const vectors = [Buffer.alloc(0), ...[55, 56, 63, 64, 65, 1048649].map(n => Buffer.from(Array.from({ length: n }, (_, i) => i % 251))), f.remote.get('https://packs.test/metro/1/chunk-0.gz')];
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {} });
    for (const bytes of vectors) assert.equal(await packSha256(bytes), sha(bytes));
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { subtle: { digest() { throw new Error('native-digest-failure'); } } } });
    await assert.rejects(packSha256(Buffer.from('test')), /native-digest-failure/);
  } finally { Object.defineProperty(globalThis, 'crypto', descriptor); }
});

test('catalog checks detect content changes without downloading or rewriting installed packages', async () => {
  const f = fixture(), files = { 'data/metro.json': Buffer.from('same') };
  const first = f.pack('metro', '1', [files]); first.contentSha256 = sha('same-content');
  f.catalog.packages[0].contentSha256 = first.contentSha256;
  const m = f.manager(); await m.load(); await m.install('metro');
  const next = f.pack('metro', '2', [files]); next.contentSha256 = first.contentSha256;
  f.catalog.packages[0].contentSha256 = next.contentSha256;
  const start = f.calls.length; await m.refreshCatalog();
  assert.equal(m.getUpdateSummary().available, false, 'release label alone must not require the same content again');
  assert.deepEqual(f.calls.slice(start).map(c => [c.url, c.method]), [['https://packs.test/catalog.json', 'GET']]);
  f.catalog.packages[0].contentSha256 = sha('changed-content'); await m.refreshCatalog();
  assert.deepEqual(m.getUpdateSummary().items.map(item => item.id), ['metro']);
  assert.equal(m.getState().packages.metro.installed.version, '1');
});

test('hidden dependency index update belongs to the installed region and failed catalog checks retain known state', async () => {
  const f = fixture();
  const common = f.pack('common', '1', [{ 'data/index.json': Buffer.from('index') }]);
  common.contentSha256 = sha('index1'); common.components = { indexes: { version: '1', sha256: sha('index1'), bytes: 5, fileCount: 1 } };
  Object.assign(f.catalog.packages[0], { contentSha256: common.contentSha256, components: common.components, internal: true });
  const metro = f.pack('metro', '1', [{ 'data/place.json': Buffer.from('place') }], ['common']); metro.contentSha256 = sha('place1');
  f.catalog.packages[1].contentSha256 = metro.contentSha256;
  const m = f.manager(); await m.load(); await m.install('metro');
  const notes = []; const stop = m.subscribeUpdates(value => notes.push(value));
  f.catalog.packages[0].contentSha256 = sha('index2'); f.catalog.packages[0].components = { indexes: { version: '2', sha256: sha('index2') } };
  await m.refreshCatalog();
  assert.deepEqual(m.getUpdateSummary().items.map(item => [item.id, item.changes]), [['metro', ['indexes']]]);
  assert.equal(m.getState().updates.available, true);
  f.failed.add('https://packs.test/catalog.json'); await assert.rejects(m.refreshCatalog(), /503/);
  assert.equal(m.getUpdateSummary().available, true); assert.match(m.getUpdateSummary().error, /503/);
  assert.ok(notes.some(value => value.checking)); stop();
});

test('incremental update separately reports reused bytes and actual downloaded bytes', async () => {
  const f = fixture(), stable = { 'data/stable.json': Buffer.from('stable') };
  f.pack('metro', '1', [stable, { 'data/change.json': Buffer.from('old') }]);
  const m = f.manager(); await m.load(); await m.install('metro');
  const next = f.pack('metro', '2', [stable, { 'data/change.json': Buffer.from('new') }]); await m.refreshCatalog();
  assert.equal(m.getUpdateSummary().downloads.metro, next.chunks[1].bytes);
  assert.equal(m.getUpdateSummary().items[0].downloadBytes, next.chunks[1].bytes);
  await m.install('metro');
  const operation = m.getState().operation;
  assert.equal(operation.reusedBytes, next.chunks[0].bytes);
  assert.equal(operation.downloadedBytes, next.chunks[1].bytes);
  assert.equal(operation.receivedBytes, operation.reusedBytes + operation.downloadedBytes);
  assert.equal(f.calls.some(c => c.url === 'https://packs.test/metro/2/chunk-0.gz'), false);
});

test('catalog sizes include dependencies once and no check fetches manifests or content', async () => {
  const f = fixture(), shared = { 'data/shared.json': Buffer.from('shared') };
  const common = f.pack('common', '1', [shared]);
  const metro = f.pack('metro', '1', [shared, { 'data/place.json': Buffer.from('place') }], ['common']);
  const m = f.manager(); await m.load(); const start = f.calls.length; await m.refreshCatalog();
  assert.equal(m.getUpdateSummary().downloads.metro, metro.chunks.reduce((n, c) => n + c.bytes, 0));
  assert.equal(common.chunks[0].sha256, metro.chunks[0].sha256);
  assert.deepEqual(f.calls.slice(start).map(c => c.url), ['https://packs.test/catalog.json']);
  assert.equal(m.getUpdateSummary().available, false);
});

test('optional regions download without enabling and both enabled and disabled updates preserve their choice', async () => {
  const f=fixture();f.pack('other','1',[{'data/other.json':Buffer.from('one')}]);
  const m=f.manager();await m.load();await m.install('other');
  assert.equal(m.getState().packages.other.enabled,false);assert.deepEqual(m.getActiveSnapshot().activePackIds,[]);
  await m.setEnabled('other',true);assert.deepEqual(m.getActiveSnapshot().activePackIds,['other']);
  f.pack('other','2',[{'data/other.json':Buffer.from('two')}]);await m.refreshCatalog();await m.install('other');
  assert.equal(m.getState().packages.other.enabled,true);
  await m.setEnabled('other',false);f.pack('other','3',[{'data/other.json':Buffer.from('three')}]);await m.refreshCatalog();await m.install('other');
  assert.equal(m.getState().packages.other.enabled,false);assert.deepEqual(m.getActiveSnapshot().activePackIds,[]);
});

test('metro readiness requires usable installed dependencies and enabled state, never the historical setup flag', async () => {
  const f=fixture();f.pack('common','1',[{'data/common.json':Buffer.from('shared')}]);f.pack('metro','1',[{'data/metro.json':Buffer.from('metro')}],['common']);
  const m=f.manager();await m.load();await m.install('metro');assert.equal(m.getState().ready,true);
  const saved=JSON.parse(f.host.get(registryUrl));saved.packages.metro.enabled=false;f.host.set(registryUrl,Buffer.from(JSON.stringify(saved)));
  const reopened=f.manager();await reopened.load();assert.equal(reopened.getState().ready,false);
  const before=f.calls.length;await reopened.setEnabled('metro',true);assert.equal(reopened.getState().ready,true);
  assert.equal(f.calls.slice(before).some(call=>call.url.startsWith('https://packs.test/')),false);
  await assert.rejects(reopened.setEnabled('metro',false),/首都圈/);await assert.rejects(reopened.remove('metro'),/首都圈/);
  const missing=JSON.parse(f.host.get(registryUrl));delete missing.chunks[missing.packages.common.installed.manifest.chunks[0].sha256];f.host.set(registryUrl,Buffer.from(JSON.stringify(missing)));
  const damaged=f.manager();await damaged.load();assert.equal(damaged.getState().ready,false);
  f.host.set(registryUrl,Buffer.from(JSON.stringify({schemaVersion:1,setupComplete:true,packages:{},chunks:{}})));
  const removed=f.manager();await removed.load();assert.equal(removed.getState().ready,false);
});

test('install impact includes active hidden dependencies and treats unknown or legacy metadata conservatively', async () => {
  const f=fixture(),shared={'data/shared.json':Buffer.from('shared')};
  f.pack('common','1',[shared]);f.pack('metro','1',[{'data/metro.json':Buffer.from('metro')}],['common']);f.pack('other','1',[{'data/other.json':Buffer.from('other')}],['common']);
  const m=f.manager();await m.load();await m.install('metro');
  assert.equal(m.getState().packages.common.enabled,false);assert.equal(m.installChangesActive('metro'),true);assert.equal(m.installChangesActive('other'),false);
  f.pack('common','2',[{'data/shared.json':Buffer.from('changed')}]);await m.refreshCatalog();assert.equal(m.installChangesActive('other'),true);
  f.pack('common','3',[shared]);await m.refreshCatalog();assert.equal(m.installChangesActive('other'),false);
  delete f.catalog.packages.find(entry=>entry.id==='common').contentSha256;await m.refreshCatalog();assert.equal(m.installChangesActive('other'),true);
  assert.equal(m.installChangesActive('not-in-catalog'),true);
});
