import test from 'node:test';
import assert from 'node:assert/strict';
import { entryStore } from './helpers/entry-dom.mjs';
import { createWorkflowOffer, WORKFLOW_TOUR_VERSION } from '../src/workflow-tour.js';

test('first use and an upgrade both open the workflow regardless of the old page-help preference', async () => {
  for (const guide of [{}, { completed: true, autoPrompt: false }]) {
    const store = entryStore({ extensionUi: { guide, theme: 'night' }, livingJapanSettings: { wrapperMode: 'brief' } });
    let calls = 0;
    const offer = createWorkflowOffer({ store, start: async scope => { calls++; assert.equal(scope, 'all'); return true; } });
    assert.equal(await offer(), true);
    assert.equal(calls, 1);
    assert.equal(store.read().extensionUi.workflowTour.seenVersion, WORKFLOW_TOUR_VERSION);
    assert.deepEqual(store.read().extensionUi.guide, guide);
    assert.equal(store.read().livingJapanSettings.wrapperMode, 'brief');
    assert.equal(await offer(), false);
    assert.equal(calls, 1);
  }
});

test('a failed or cancelled launch does not claim this version has been shown', async () => {
  for (const result of ['reject', false]) {
    const store = entryStore();
    const offer = createWorkflowOffer({ store, start: async () => { if (result === 'reject') throw Error('load failed'); return result; } });
    if (result === 'reject') await assert.rejects(offer, /load failed/); else assert.equal(await offer(), false);
    assert.equal(store.read().extensionUi?.workflowTour, undefined);
  }
});

test('parallel startup checks share one launch and a later tour version is eligible', async () => {
  const store = entryStore({ extensionUi: { workflowTour: { seenVersion: 'older', completedVersion: 'older' } } });
  let finish, calls = 0;
  const offer = createWorkflowOffer({ store, start: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  const first = offer(), second = offer(); finish(true);
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(calls, 1);
  assert.equal(store.read().extensionUi.workflowTour.completedVersion, 'older');
});
