import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARCHITECTURAL_FEATURES,
  getFeatureById,
  getVisibleFeaturesForYear,
} from './architecturalFeatures.ts';

test('architectural feature catalog defines unique ids, camera framings, and trivia', () => {
  const seen = new Set<string>();
  for (const feat of ARCHITECTURAL_FEATURES) {
    assert.ok(!seen.has(feat.id), `Duplicate feature id: ${feat.id}`);
    seen.add(feat.id);
    assert.ok(feat.trivia.length >= 2, `Expected >=2 trivia facts for ${feat.id}`);
    assert.ok(feat.hitRadius > 0);
    const camDist = Math.hypot(
      feat.cameraPosition[0] - feat.cameraTarget[0],
      feat.cameraPosition[1] - feat.cameraTarget[1],
      feat.cameraPosition[2] - feat.cameraTarget[2]
    );
    assert.ok(camDist >= 10 && camDist <= 40, `Close-up distance out of range for ${feat.id}: ${camDist}`);
  }
});

test('getFeatureById resolves matching entries and returns null for unknown ids', () => {
  assert.equal(getFeatureById('nativity-portal')?.label, 'Nativity Portals');
  assert.equal(getFeatureById('passion-portal')?.label, 'Passion Portals');
  assert.equal(getFeatureById('non-existent'), null);
  assert.equal(getFeatureById(null), null);
});

test('getVisibleFeaturesForYear reveals features progressively across history', () => {
  const early = getVisibleFeaturesForYear(1926).map((f) => f.id);
  assert.ok(early.includes('nativity-portal'));
  assert.ok(early.includes('apse-chapels'));
  assert.ok(!early.includes('jesus-tower'));

  const complete = getVisibleFeaturesForYear(2026);
  assert.equal(complete.length, ARCHITECTURAL_FEATURES.length);
});
