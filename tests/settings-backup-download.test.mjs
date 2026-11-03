import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSettings } from '../ui/settings.js';

test('settings keeps the real exported backup link retryable and replaces it only on a new export', async t => {
  const previousDocument = globalThis.document;
  const clicks = [], notices = [], revoked = [], blobs = new Map();
  const handlers = {};
  let html = '', link = null, revision = 1, unload;
  const content = {
    classList: { add() {} }, contains: () => false, scrollTop: 0,
    addEventListener: (event, handler) => { handlers[event] = handler; },
    querySelectorAll: () => [],
    querySelector: selector => selector === '[data-settings-backup-download]' ? link : null,
    get innerHTML() { return html; },
    set innerHTML(value) {
      html = value;
      const match = value.match(/<a [^>]*data-settings-backup-download[^>]*href="([^"]+)"[^>]*download="([^"]+)"/);
      link = match ? { href: match[1], download: match[2], click() { assert.equal(this, link); clicks.push(this.href); } } : null;
    },
  };
  globalThis.document = {
    getElementById: id => id === 'settingsScroll' ? content : id === 'settingsTabs' ? { addEventListener() {} } : null,
    createElement: () => ({ click() { clicks.push('detached'); } }),
    defaultView: { addEventListener(event, handler) { if (event === 'unload') unload = handler; } },
  };
  t.after(() => { globalThis.document = previousDocument; });
  t.mock.method(globalThis, 'setTimeout', () => 0);
  t.mock.method(URL, 'createObjectURL', blob => {
    const url = 'blob:https://fixture.invalid/' + (blobs.size + 1);
    blobs.set(url, blob);
    return url;
  });
  t.mock.method(URL, 'revokeObjectURL', url => revoked.push(url));
  const settings = { textScript: 'simplified', wrapperMode: 'background', historyDepth: 2, currentUserBoundary: {}, channelTags: {}, layers: {} };
  const view = mountSettings({
    layout: 'portrait', esc: String, notify: text => notices.push(text),
    engine: { data: { wrappers: {} }, normalizeSettings: value => value, normalizeTextOverrides: value => value },
    bridge: { store: {
      read: () => ({ livingJapanSettings: settings, livingJapanTextOverrides: { records: {}, orphans: {} } }),
      exportBackup: () => JSON.stringify({ revision, body: '原样正文' }),
    } },
  });
  const exportClick = () => handlers.click({ target: { closest: selector => selector === '[data-settings-action]' ? { dataset: { settingsAction: 'export' } } : null } });
  view.openTab('backup');
  await exportClick();
  assert.ok(link);
  const first = link.href;
  assert.deepEqual(clicks, [first]);
  assert.match(link.download, /^Living-Japan-用户备份-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(await blobs.get(first).text(), '{"revision":1,"body":"原样正文"}');
  assert.match(notices.at(-1), /已生成/);
  assert.deepEqual(revoked, []);
  view.openTab('common'); assert.equal(link, null);
  view.openTab('backup'); assert.equal(link.href, first);
  link.click();
  assert.deepEqual(clicks, [first, first]);
  revision++;
  await exportClick();
  assert.notEqual(link.href, first);
  assert.deepEqual(revoked, [first]);
  assert.equal(await blobs.get(link.href).text(), '{"revision":2,"body":"原样正文"}');
  const second = link.href;
  unload();
  view.destroy();
  assert.deepEqual(revoked, [first, second]);
});
