import test from 'node:test';
import assert from 'node:assert/strict';
import { createBaselineEngine } from '../src/baseline.js';
import { categoryPath, materialOwnFragmentId, materialPackageId } from '../src/material-library.js';
import { createSession } from '../src/session.js';
import { createUserStore } from '../src/storage.js';
import { createPlaceDraft, placeDraftPayload } from '../ui/place-editor.js';
import { emptyMaterialRuntime } from './helpers/material-runtime.mjs';

test('place binding edits survive shared material refresh and an empty override survives reopening', async () => {
  const place = { id: 'workflow-place', name: '验收地点', type: '公园', kind: 'poi' };
  const categoryId = 'ex.greenery.street-trees';
  let saved = {
    materialLibrary: {
      places: { [place.id]: place },
      bindings: { original: { entityId: place.id, categoryId, enabled: true } },
    },
  };
  const transport = {
    read: async () => structuredClone(saved),
    write: async value => { saved = structuredClone(value); },
  };
  const engine = createBaselineEngine(emptyMaterialRuntime());
  const prepare = async () => false;
  prepare.resolveBuiltin = async id => id === place.id ? place : null;
  prepare.resolve = prepare.resolveBuiltin;
  async function openSession() {
    const store = createUserStore({ transport });
    await store.load();
    return { store, session: createSession({ engine, store, prepareUserData: prepare }) };
  }

  const { store, session } = await openSession();
  const draft = createPlaceDraft(await session.runtime.readPlaceEdit(place.id));
  assert.equal(draft.bindings.length, 1);
  assert.equal(draft.bindings[0].categoryId, categoryId);
  draft.bindings[0].enabled = false;

  const library = store.read().materialLibrary;
  library.categories['workflow-tree'] = { name: '行道树', parentId: 'ex.greenery', layer: 'EX' };
  await session.runtime.saveMaterialLibrary(library);
  await session.refresh();
  assert.deepEqual(categoryPath(session.engine.data.materialLibrary, 'workflow-tree').map(row => row.name), ['植物与绿化', '行道树']);
  const packageId = materialPackageId(materialOwnFragmentId('workflow-tree'));
  await session.runtime.saveTextOverride(packageId, null, '独立保存的词条正文');
  await session.refresh();

  await session.runtime.savePlaceEdit(draft.id, placeDraftPayload(draft));
  const paused = await session.runtime.readPlaceEdit(place.id);
  assert.deepEqual(paused.bindings.map(row => [row.categoryId, row.enabled]), [[categoryId, false]]);

  const removal = createPlaceDraft(paused);
  removal.bindings = [];
  const payload = placeDraftPayload(removal);
  assert.deepEqual(payload.bindings, []);
  await session.runtime.savePlaceEdit(removal.id, payload);

  const reopened = await openSession();
  assert.deepEqual(reopened.store.read().placeEdits.overrides[place.id].bindings, []);
  assert.equal(reopened.store.read().materialLibrary.bindings.original.categoryId, categoryId);
  assert.deepEqual((await reopened.session.runtime.readPlaceEdit(place.id)).bindings, []);
  assert.ok(reopened.session.engine.data.materialLibrary.categories[categoryId]);
  assert.equal((await reopened.session.runtime.readTextOverrides()).records['P/' + packageId].body, '独立保存的词条正文');
});
