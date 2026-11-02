import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateManager, inspectBuiltinChanges } from '../src/updates.js';

test('extension check and update only call host extension endpoints, leaving user data intact', async () => {
  const userData = { revision: 7, customSlots: { a: { body: '保存稿' } } };
  const before = structuredClone(userData);
  const requests = [];
  const fetcher = async (url, options) => {
    requests.push(url);
    assert.deepEqual(JSON.parse(options.body), { extensionName: 'Living-Japan', global: false });
    assert.equal(options.headers['X-CSRF-Token'], 'test-token');
    if (url === '/api/extensions/version') return Response.json({ currentCommitHash: 'abc', currentBranchName: 'main', isUpToDate: false, remoteUrl: 'https://github.com/yyxz223-stack/Living-Japan' });
    if (url === '/api/extensions/update') return Response.json({ shortCommitHash: 'def', isUpToDate: false, remoteUrl: 'https://github.com/yyxz223-stack/Living-Japan' });
    throw new Error(`unexpected endpoint ${url}`);
  };
  const manager = createUpdateManager({ context: { getRequestHeaders: () => ({ 'X-CSRF-Token': 'test-token' }) }, fetcher, global: false, version: 'v20261102' });
  assert.equal(manager.getState().version, 'v20261102');
  const checked = await manager.check();
  assert.equal(checked.available, true); assert.equal(checked.checking, false);
  assert.equal(checked.version, 'v20261102');
  assert.equal((await manager.update()).reloadRequired, true);
  assert.deepEqual(userData, before);
  assert.deepEqual(requests, ['/api/extensions/version', '/api/extensions/update']);
});

test('ZIP installation and failed update do not claim update success', async () => {
  const zip = createUpdateManager({ global: false, fetcher: async () => Response.json({ currentBranchName: '', currentCommitHash: '', isUpToDate: true, remoteUrl: '' }) });
  assert.equal((await zip.check()).supported, false);
  const failing = createUpdateManager({ global: false, fetcher: async () => new Response('server failure', { status: 500 }) });
  await assert.rejects(failing.update(), /500/);
});

test('extension update discovers the actual global installation once and uses that scope for check and update', async () => {
  const calls = [];
  const manager = createUpdateManager({ extensionName: 'Living-Japan', fetcher: async (url, options) => {
    calls.push(url);
    if (url === '/api/extensions/discover') return Response.json([{ name: 'third-party/Living-Japan', type: 'global' }]);
    assert.deepEqual(JSON.parse(options.body), { extensionName: 'Living-Japan', global: true });
    return Response.json(url.endsWith('/version') ? { currentCommitHash: 'abc', remoteUrl: 'https://example.test/project', isUpToDate: false } : { shortCommitHash: 'def', isUpToDate: false });
  } });
  assert.equal((await manager.check()).available, true); assert.equal((await manager.update()).reloadRequired, true);
  assert.deepEqual(calls, ['/api/extensions/discover', '/api/extensions/version', '/api/extensions/update']);
});

test('unknown installation is reported as unsupported without checking a guessed local directory', async () => {
  const calls = [];
  const manager = createUpdateManager({ fetcher: async url => { calls.push(url); return Response.json([]); } });
  assert.equal((await manager.check()).supported, false);
  assert.deepEqual(calls, ['/api/extensions/discover']);
});

test('builtin version/hash comparison reports changed original and preserves all user records', () => {
  const container = { livingJapanTextOverrides: { records: { 'P/a': { body: '原有用户稿', baseBuiltinSha256: 'old' }, 'P/b': { body: '另一个稿', baseBuiltinSha256: 'same' } }, orphans: {} }, customSlots: { custom: { body: '自建稿' } } };
  const before = structuredClone(container);
  const changes = inspectBuiltinChanges(container, { version: 'v-next', slots: { 'P/a': { bodySha256: 'new' }, 'P/b': { bodySha256: 'same' } } });
  assert.deepEqual(changes.changedSlotKeys, ['P/a']);
  assert.deepEqual(changes.missingSlotKeys, []);
  assert.deepEqual(container, before);
});
