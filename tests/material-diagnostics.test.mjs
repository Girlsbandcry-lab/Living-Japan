import test from 'node:test';
import assert from 'node:assert/strict';
import * as diagnostics from '../ui/diagnostics.js';
test('material diagnostics expose regional, time, empty and switch outcomes as readable rows', () => {
  assert.equal(typeof diagnostics.materialDiagnosticRows, 'function');
  const rows = diagnostics.materialDiagnosticRows({ materialPipeline: { skipped: [
    { id: 'snow', reason: 'region_mismatch' }, { id: 'night', reason: 'time_or_weather_mismatch' },
    { id: 'blank', reason: 'empty_body' }, { id: 'off', reason: 'binding_off' }
  ], legacyClimateSkipped: [{ id: 'old', reason: 'outside_legacy_metro_scope' }] } });
  assert.equal(rows.length, 5);
  assert.ok(rows.every(row => /[\u4e00-\u9fff]/.test(row.explanation)));
  assert.equal(rows.find(row => row.input.id.endsWith('blank')).status, 'empty');
  assert.equal(rows.find(row => row.input.id.endsWith('off')).status, 'closed');
});
