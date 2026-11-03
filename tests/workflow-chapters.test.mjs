import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKFLOW_CHAPTERS, workflowChapters, workflowSteps, workflowStep } from '../ui/workflow-chapters.js';

test('the task guide has ten independently selectable chapters with usable sequential step IDs', () => {
  assert.deepEqual(WORKFLOW_CHAPTERS.map(chapter => chapter.id), ['interface', 'map', 'locations', 'edit', 'bindings', 'packages', 'conditions', 'places', 'check', 'save']);
  const all = workflowSteps();
  assert.equal(new Set(all.map(entry => entry.id)).size, all.length);
  assert.deepEqual(JSON.parse(JSON.stringify(WORKFLOW_CHAPTERS)), WORKFLOW_CHAPTERS, 'declarations must remain portable plain data');
  for (const chapter of WORKFLOW_CHAPTERS) {
    assert.ok(chapter.label && chapter.summary);
    assert.ok(chapter.steps.length >= 6 && chapter.steps.length <= 10, chapter.id);
    const selected = workflowSteps(chapter.id);
    assert.equal(selected.length, chapter.steps.length);
    selected.forEach((entry, index) => {
      assert.ok(entry.title && entry.text && entry.action, entry.id);
      assert.equal(entry.chapterId, chapter.id);
      assert.equal(entry.chapterIndex, index);
      assert.equal(entry.chapterCount, selected.length);
      assert.equal(entry.stepId, chapter.steps[index].id);
    });
  }
});

test('selecting and replaying a chapter does not rewrite the source steps or leak another chapter', () => {
  const before = JSON.stringify(WORKFLOW_CHAPTERS);
  assert.deepEqual(workflowChapters('missing'), []);
  assert.deepEqual(workflowSteps('missing'), []);
  assert.equal(workflowStep('missing'), null);
  for (const chapter of WORKFLOW_CHAPTERS) {
    assert.deepEqual(workflowChapters(chapter.id), [chapter]);
    assert.equal(workflowStep(chapter.id, -1), null);
    assert.equal(workflowStep(chapter.id, 0.5), null);
    assert.equal(workflowStep(chapter.id, chapter.steps.length), null);
    const first = workflowStep(chapter.id);
    assert.equal(first.id, `${chapter.id}:${chapter.steps[0].id}`);
    first.title = 'display-only change';
    assert.notEqual(workflowStep(chapter.id).title, first.title);
    const list = workflowChapters();
    list.length = 0;
    assert.equal(workflowChapters().length, 10);
  }
  assert.equal(JSON.stringify(WORKFLOW_CHAPTERS), before);
});

test('the chapter routes include actual outward and return actions before describing results', () => {
  const sequence = (chapterId, expected) => {
    const actions = workflowSteps(chapterId).map(entry => entry.action);
    let after = -1;
    for (const action of expected) {
      const index = actions.indexOf(action, after + 1);
      assert.ok(index > after, `${chapterId} must reach ${action} after ${expected.slice(0, expected.indexOf(action)).join(', ')}`);
      after = index;
    }
  };
  sequence('interface', ['host.chat', 'diagnostic.preview', 'diagnostic.show']);
  sequence('map', ['map.select', 'map.append', 'map.origin', 'map.select', 'map.destination', 'map.travel', 'map.depart']);
  sequence('edit', ['place.open', 'place.fill', 'place.pick', 'place.confirmPosition', 'place.fill', 'place.save', 'place.open']);
  sequence('bindings', ['bindings.add', 'bindings.choose', 'bindings.complete', 'place.save', 'host.chat', 'diagnostic.preview']);
  sequence('packages', ['bindings.preview', 'bindings.edit', 'material.edit', 'material.save', 'material.returnPlace', 'bindings.preview']);
  sequence('conditions', ['conditions.open', 'conditions.fill', 'conditions.save', 'host.chat', 'diagnostic.preview', 'host.chat', 'diagnostic.preview']);
  sequence('places', ['settings.set', 'diagnostic.preview', 'host.quickMenu', 'host.quickMode', 'settings.open', 'settings.set', 'settings.save', 'diagnostic.preview']);
  sequence('check', ['diagnostic.preview', 'diagnostic.openSettings', 'host.chat', 'diagnostic.preview', 'diagnostic.openResult', 'diagnostic.preview']);
});

test('file, update and external macro illustrations are explicit and never replace the core cross-page flows', () => {
  const illustrations = workflowSteps().filter(entry => entry.action === 'illustration');
  assert.ok(illustrations.length > 0);
  for (const entry of illustrations) {
    assert.equal(entry.surface, 'illustration');
    assert.ok(entry.chapterId === 'save' || entry.chapterId === 'check' && entry.params.kind === 'macro', entry.id);
    assert.ok(entry.params.title && entry.params.stages.length >= 3, entry.id);
    assert.ok(entry.params.stages.every(stage => stage.title && stage.text), entry.id);
  }
  for (const chapter of ['edit', 'bindings', 'packages', 'conditions', 'places']) {
    assert.ok(workflowSteps(chapter).every(entry => entry.action !== 'illustration'), chapter);
  }
});

test('declared driver parameters use agreed entities, modes and save scopes', () => {
  const entities = new Set(['cafe', 'court', 'hall', 'city', 'new']);
  const materials = new Set(['wood', 'rain']);
  for (const entry of workflowSteps()) {
    const p = entry.params;
    assert.ok(p && typeof p === 'object' && !Array.isArray(p), entry.id);
    if (p.entity) assert.ok(entities.has(p.entity), entry.id);
    if (p.parent) assert.ok(entities.has(p.parent), entry.id);
    if (p.material) assert.ok(materials.has(p.material), entry.id);
    if (entry.action === 'host.quickMode') assert.ok(['background', 'brief', 'standard', 'detailed'].includes(p.mode), entry.id);
    if (entry.action === 'map.travel') assert.equal(p.mode, 'walking');
    if (entry.action === 'settings.set') assert.ok(['common', 'reading', 'quota', 'map', 'favorite'].includes(p.scope), entry.id);
    if (entry.action === 'settings.save') assert.ok(['reading', 'favorites'].includes(p.scope), entry.id);
    if (entry.action === 'settings.open') assert.ok(['common', 'reading', 'favorites', 'backup'].includes(p.tab), entry.id);
    if (entry.action === 'conditions.fill') {
      assert.deepEqual(p.weatherTypes, ['light_rain']);
      assert.ok(p.months.every(month => Number.isInteger(month) && month >= 1 && month <= 12));
    }
  }
});
