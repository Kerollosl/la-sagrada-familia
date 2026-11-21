import test from 'node:test';
import assert from 'node:assert/strict';
import { getNarrationCue } from './narration';

test('getNarrationCue maps key historical years to distinct narration scripts', () => {
  const c1882 = getNarrationCue(1882);
  assert.equal(c1882.yearRange, '1882–1883');
  assert.ok(c1882.spokenText.includes('1882'));

  const c1926 = getNarrationCue(1926);
  assert.equal(c1926.yearRange, '1906–1926');
  assert.ok(c1926.spokenText.includes('Nativity'));

  const c1970 = getNarrationCue(1970);
  assert.equal(c1970.yearRange, '1952–1976');
  assert.ok(c1970.spokenText.includes('Passion'));

  const c2010 = getNarrationCue(2010);
  assert.equal(c2010.yearRange, '1995–2010');
  assert.ok(c2010.spokenText.includes('2010'));

  const c2026 = getNarrationCue(2026);
  assert.equal(c2026.yearRange, '2022–2026+');
  assert.ok(c2026.spokenText.includes('Jesus Christ'));
});
