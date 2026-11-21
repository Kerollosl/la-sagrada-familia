import test from 'node:test';
import assert from 'node:assert/strict';
import { computeWingFlapAngle, createBirdFlock, stepBirdFlock } from './birdFlocking.ts';

test('createBirdFlock initializes distinct upper spire swifts and lower plaza birds', () => {
  const flock = createBirdFlock(36);
  assert.equal(flock.length, 36);

  const highCount = flock.filter((b) => b.flockGroup === 0).length;
  const lowCount = flock.filter((b) => b.flockGroup === 1).length;
  assert.ok(highCount > 15 && lowCount > 8);

  for (const b of flock) {
    assert.ok(Math.hypot(b.x, b.z) >= 14.0, 'Birds should start clear of central towers');
  }
});

test('stepBirdFlock advances positions smoothly while keeping birds bounded and clear of core', () => {
  const flock = createBirdFlock(36);
  const startX = flock[0].x;
  const startPhase = flock[0].wingPhase;

  for (let s = 0; s < 120; s++) {
    stepBirdFlock(flock, 0.03, s * 0.03);
  }

  assert.notEqual(flock[0].x, startX);
  assert.ok(flock[0].wingPhase > startPhase);

  for (const b of flock) {
    assert.ok(b.y >= 4.5 && b.y <= 48.0, `Altitude out of bounds: ${b.y}`);
    assert.ok(Math.hypot(b.x, b.z) > 10.5, 'Birds should steer around the spire core');
  }
});

test('wing flap attenuates during glides and oscillates during climbs', () => {
  const climbFlap = computeWingFlapAngle(Math.PI / 2, 0.8);
  const glideFlap = computeWingFlapAngle(Math.PI / 2, -1.2);
  assert.ok(Math.abs(climbFlap) > Math.abs(glideFlap));
});
