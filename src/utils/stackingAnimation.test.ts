import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStackTransform } from './stackingAnimation';

test('piece remains hidden before its build window starts', () => {
  const tf = computeStackTransform(0.2, 0.25, 0.55, 6.0, 'drop');
  assert.equal(tf.visible, false);
  assert.equal(tf.localT, 0);
});

test('drop mode descends monotonically from dropHeight toward 0 without sinking below seat', () => {
  const early = computeStackTransform(0.3, 0.2, 0.6, 6.0, 'drop');
  const mid = computeStackTransform(0.4, 0.2, 0.6, 6.0, 'drop');
  const late = computeStackTransform(0.55, 0.2, 0.6, 6.0, 'drop');

  assert.equal(early.visible, true);
  assert.ok(early.offsetY > mid.offsetY && mid.offsetY > late.offsetY);
  assert.ok(late.offsetY > 0);
  assert.ok(early.scaleXY > 0.7 && early.scaleXY <= 1);
});

test('piece locks cleanly to final resting transform at end of build window', () => {
  const done = computeStackTransform(0.7, 0.2, 0.6, 6.0, 'drop');
  assert.equal(done.visible, true);
  assert.equal(done.offsetY, 0);
  assert.equal(done.scaleXY, 1);
  assert.equal(done.scaleY, 1);
  assert.equal(done.localT, 1);
});

test('growY mode scales vertically from base without vertical drop offset', () => {
  const mid = computeStackTransform(0.5, 0.0, 1.0, 5.0, 'growY');
  assert.equal(mid.visible, true);
  assert.equal(mid.offsetY, 0);
  assert.ok(mid.scaleY > 0.5 && mid.scaleY < 1.0);
});
