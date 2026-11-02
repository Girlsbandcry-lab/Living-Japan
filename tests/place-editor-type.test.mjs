import test from 'node:test';
import assert from 'node:assert/strict';
import { placeEditValues } from '../src/place-edits.js';
import { createPlaceDraft, createPlaceEditor, placeDraftPayload } from '../ui/place-editor.js';

function renderEditor(entity, run) {
  const previous = globalThis.document, listeners = new Map();
  let host;
  const dock = { append(node) { host = node; } };
  globalThis.document = {
    querySelector: selector => selector === '#ljPlaceEditorStyle' ? {} : selector === '#loc10DetailBody' ? dock : null,
    body: { classList: { add() {}, remove() {} } },
    createElement: () => ({ setAttribute() {}, remove() {}, querySelector: () => null,
      querySelectorAll: () => [], addEventListener: (name, callback) => listeners.set(name, callback) }),
  };
  const values = placeEditValues(entity);
  const snapshot = { id: entity.id, isNew: false, values, builtin: structuredClone(values),
    bodyVariants: [], bindings: [], overriddenFields: [], permissions: { structure: true, coordinates: false } };
  const draft = createPlaceDraft(snapshot);
  const ui = { layout: 'desktop', state: { page: 'region', placeEditor: draft },
    engine: { data: {} }, bridge: { catalog: { get: () => null } } };
  try {
    createPlaceEditor(ui).render();
    const html = host.innerHTML.match(/<select id="lj-place-type"[^>]*>([\s\S]*?)<\/select>/)[1];
    const selected = [...html.matchAll(/<option value="([^"]*)"([^>]*)>(.*?)<\/option>/g)]
      .filter(match => /\bselected\b/.test(match[2])).map(match => ({ value: match[1], label: match[3] }));
    const choose = value => listeners.get('change')({ target: { value, dataset: {}, hasAttribute: name => name === 'data-place-type' } });
    run({ selected, choose, draft, snapshot });
  } finally { globalThis.document = previous; }
}

test('a structural place keeps its current type selected instead of its coarse map category', () => {
  const entity = { id: 'area', name: '南生田北侧周边', type: '生活片区', displayType: '生活片区', categoryCode: '景', typePathIds: [] };
  const before = structuredClone(entity);
  renderEditor(entity, ({ selected, draft, snapshot }) => {
    assert.deepEqual(selected, [{ value: '', label: '生活片区（当前）' }]);
    assert.equal(draft.values.typeId, '景', 'the snapshot and stored category semantics are untouched');
    assert.deepEqual(placeDraftPayload(draft).fields, {});
    assert.deepEqual(snapshot.values, draft.values);
  });
  assert.deepEqual(entity, before);
});

test('an exact concrete or coarse type remains selected when its visible label agrees', () => {
  for (const entity of [
    { id: 'museum', name: '展馆', type: '博物馆', materialTypeId: 'in.culture.museum' },
    { id: 'sight', name: '景区', type: '景点', categoryCode: '景' },
  ]) renderEditor(entity, ({ selected, draft }) => {
    assert.deepEqual(selected, [{ value: entity.materialTypeId || entity.categoryCode, label: entity.type }]);
    assert.deepEqual(placeDraftPayload(draft).fields, {});
  });
});

test('choosing another type then the displayed current option restores that render original type and ID', () => {
  renderEditor({ id: 'area', name: '片区', type: '生活片区', categoryCode: '景' }, ({ choose, draft, snapshot }) => {
    choose('in.culture.museum');
    assert.deepEqual(placeDraftPayload(draft).fields, { type: '博物馆', typeId: 'in.culture.museum' });
    choose('');
    assert.equal(draft.values.type, '生活片区');
    assert.equal(draft.values.typeId, '景');
    assert.deepEqual(placeDraftPayload(draft).fields, {});
    assert.deepEqual(draft.values, snapshot.values);
  });
});
