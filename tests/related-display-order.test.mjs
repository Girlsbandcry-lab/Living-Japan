import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalog } from '../src/catalog.js';
import { canonicalAliasBucket } from '../src/canonical-places.js';
import { createRelatedSelection } from '../ui/map.js';

function fixture() {
  const peerIds = ['source', 'leaf-b', 'container-z', 'empty', 'container-a', 'leaf-a'];
  const children = { parent: peerIds, 'container-z': ['inside-z'], 'container-a': ['inside-a'] };
  const rows = ['parent', ...peerIds, 'inside-z', 'inside-a'].map(id => ({
    id, name: id, type: '地点', kind: 'poi', regionCode: '13', adminNodeId: 'ward', adminPath: ['ward'],
    // Empty objects can retain stale hints; actual membership must decide priority.
    hasChildren: id === 'empty', childCount: id === 'empty' ? 10 : 0,
    related: [
      ...Object.entries(children).filter(([, ids]) => ids.includes(id)).map(([id]) => ({ id, kind: 'within' })),
      ...(children[id] || []).map(id => ({ id, kind: 'contains' })),
    ],
  }));
  const files = { 'detail.json': { rows }, 'light.json': { rows }, 'geo.json': {
    nodes: rows.map((row, index) => ({ ...row, ref: { path: 'light.json', index },
      parents: row.related.filter(edge => edge.kind === 'within').map(({ id }) => ({ id, regionCode: '13' })) })),
  } };
  const aliases = new Map(), reads = [];
  for (const row of rows) {
    const bucket = canonicalAliasBucket(row.id), path = `alias-${bucket}.json`;
    aliases.set(bucket, { bucket, path });
    (files[path] ||= { aliases: {} }).aliases[row.id] = { id: row.id, path: 'detail.json', regionCode: '13' };
  }
  files['manifest.json'] = { runtimeSource: { kind: 'overture' }, regions: [{ code: '13' }],
    adminNodes: [{ id: 'ward', name: '区', kind: 'ward', regionCode: '13' }],
    canonicalPlaces: { parts: [{ path: 'detail.json', regionCodes: ['13'] }], aliasParts: [...aliases.values()],
      catalogIndex: { parts: [{ path: 'light.json', detailPath: 'detail.json', regionCodes: ['13'] }] },
      geographicIndex: { parts: [{ path: 'geo.json', regionCodes: ['13'] }] } },
  };
  const catalog = createCatalog({ baseUrl: 'https://fixture.invalid/', useWorker: false, fetcher: async url => {
    const name = String(url).split('/').pop(); reads.push(name); assert(files[name], name); return Response.json(files[name]);
  } });
  return { catalog, reads, peerIds: peerIds.slice(1) };
}

test('UI siblings put actual containers first, retain group order, and leave macro relations unchanged', async () => {
  const { catalog, reads, peerIds } = fixture();
  try {
    const source = await catalog.resolve('source');
    assert.equal(reads.includes('geo.json'), false, 'start before the directory is loaded');
    assert.equal(typeof catalog.relatedDisplay, 'function', 'all related UI lists need a shared display ordering');
    assert.deepEqual((await catalog.relatedDisplay(source)).map(row => row.id), ['container-z', 'container-a', 'leaf-b', 'empty', 'leaf-a']);
    assert.equal(reads.filter(name => name === 'geo.json').length, 1);
    assert.deepEqual((await catalog.related(source)).map(row => row.id), peerIds, 'macro membership and order stay untouched');
    assert.deepEqual((await catalog.browsePage('parent', { limit: 2, favoriteIds: ['leaf-a'] })).items.map(row => row.id), ['leaf-a', 'container-a'], 'directory favorites remain first before paging');
  } finally { catalog.destroy(); }
});

test('moving the final child, creating a child and restoring edits update sibling priority immediately', async () => {
  const { catalog } = fixture();
  try {
    const source = await catalog.resolve('source');
    assert.equal(typeof catalog.relatedDisplay, 'function');
    assert.equal(typeof catalog.relatedDisplayRevision, 'function');
    await catalog.relatedDisplay(source);
    const before = catalog.relatedDisplayRevision();
    const edits = { overrides: { 'inside-z': { parentId: 'leaf-a' } }, created: {
      'personal-child': { name: '个人子地点', parentId: 'empty', regionCode: '13', adminNodeId: 'ward', adminPath: ['ward'] },
    } };
    catalog.setPersonalPlaces({ placeEdits: edits, livingJapanSettings: { hiddenPlaceIds: ['inside-a', 'personal-child'] } });
    assert(catalog.relatedDisplayRevision() > before);
    assert.deepEqual((await catalog.relatedDisplay(source)).map(row => row.id), ['empty', 'container-a', 'leaf-a', 'leaf-b', 'container-z']);
    assert.equal((await catalog.browseNode('container-z')).hasChildren, false, 'last child moved away');
    assert.equal((await catalog.browseNode('empty')).childCount, 1, 'hidden personal children still count');
    const unchanged = catalog.relatedDisplayRevision();
    catalog.setPersonalPlaces({ placeEdits: structuredClone(edits) });
    assert.equal(catalog.relatedDisplayRevision(), unchanged, 're-reading identical settings must not reload the map list');
    catalog.setPersonalPlaces({});
    assert.deepEqual((await catalog.relatedDisplay(source)).map(row => row.id), ['container-z', 'container-a', 'leaf-b', 'empty', 'leaf-a']);
    assert.equal((await catalog.browseNode('empty')).hasChildren, false, 'removing the personal child removes priority');
  } finally { catalog.destroy(); }
});

test('map refreshes the same selected place after edits and ignores results from the previous revision', async () => {
  const pending = [], updates = [];
  const selection = createRelatedSelection(() => new Promise(resolve => pending.push(resolve)), rows => updates.push(rows.map(row => row.id)));
  try {
    selection.select({ id: 'source' }, 1);
    selection.select({ id: 'source' }, 1);
    assert.equal(pending.length, 1);
    selection.select({ id: 'source' }, 2);
    assert.equal(pending.length, 2, 'membership edits reload even when selection stays the same');
    pending[1]([{ id: 'new-container' }]); await new Promise(resolve => setTimeout(resolve, 0));
    pending[0]([{ id: 'old-container' }]); await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(updates, [['new-container']]);
    assert.deepEqual(selection.rows().map(row => row.id), ['new-container']);
  } finally { selection.destroy(); }
});
