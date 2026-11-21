import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_YEAR,
  MAX_YEAR,
  KEY_MILESTONES,
  computePhaseProgress,
  getHistoricalContext,
  getActiveConstructionPhases,
  formatYearDisplay,
} from './timeline';

test('timeline boundaries and clamping', () => {
  const start = computePhaseProgress(MIN_YEAR);
  assert.equal(start.crypt, 0);
  assert.equal(start.phase2, 0);
  assert.equal(start.phase3, 0);
  assert.equal(start.phase4, 0);
  assert.equal(start.overallCompletionPct, 0);

  const end = computePhaseProgress(MAX_YEAR);
  assert.equal(end.phase1, 1);
  assert.equal(end.phase2, 1);
  assert.equal(end.phase3, 1);
  assert.equal(end.phase4, 1);
  assert.equal(end.overallCompletionPct, 100);
});

test('1926 Gaudí death milestone reflects Phase 1 active and Phases 2-4 unstarted', () => {
  const p1926 = computePhaseProgress(1926);
  assert.ok(p1926.crypt === 1, 'Crypt should be complete by 1926');
  assert.ok(p1926.apse === 1, 'Apse should be complete by 1926');
  assert.ok(p1926.nativityTowers > 0.75 && p1926.nativityTowers < 1, 'Nativity towers mostly built by 1926');
  assert.equal(p1926.phase2, 0, 'Passion facade has not started in 1926');
  assert.equal(p1926.phase3, 0, 'Central nave has not started in 1926');
  assert.equal(p1926.phase4, 0, 'Central towers have not started in 1926');

  const ctx = getHistoricalContext(1926);
  assert.equal(ctx.architect, 'Antoni Gaudí');
});

test('1976 Passion Facade completion and active construction tracking', () => {
  const p1976 = computePhaseProgress(1976);
  assert.equal(p1976.phase1, 1);
  assert.equal(p1976.phase2, 1);
  assert.equal(p1976.phase3, 0);

  const p1965 = computePhaseProgress(1965);
  assert.deepEqual(getActiveConstructionPhases(p1965), ['phase2']);

  const ctx = getHistoricalContext(1970);
  assert.equal(ctx.activePhase, 'phase2');
});

test('2010 consecration activates stained glass glow and completes Phase 3', () => {
  const p2010 = computePhaseProgress(2010);
  assert.equal(p2010.phase3, 1);
  assert.ok(p2010.stainedGlassGlow > 0.85, 'Stained glass glow should illuminate by 2010');
  assert.equal(p2010.jesusTower, 0);

  const ctx = getHistoricalContext(2010);
  assert.equal(ctx.architect, 'Jordi Bonet i Armengol');
});

test('2026+ completion reaches full tower heights and 2026+ display format', () => {
  const p2026 = computePhaseProgress(2026);
  assert.equal(p2026.jesusTower, 1);
  assert.equal(p2026.virginMaryTower, 1);
  assert.equal(p2026.evangelistTowers, 1);
  assert.equal(formatYearDisplay(2026), '2026+');
  assert.equal(formatYearDisplay(1882), '1882');
  assert.equal(KEY_MILESTONES.length, 5);
});
