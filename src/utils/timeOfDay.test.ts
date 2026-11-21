import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAtmosphereState,
  normalizeTimeOfDay,
  resolveTimeOfDayPreset,
  TIME_OF_DAY_PRESETS,
} from './timeOfDay';

test('bright daylight preset produces minimal night factor and clear azure sky', () => {
  const day = computeAtmosphereState(TIME_OF_DAY_PRESETS.day);
  assert.equal(day.presetLabel, 'Daylight');
  assert.equal(day.nightFactor, 0);
  assert.equal(day.spireGlowIntensity, 0);
  assert.equal(day.starfieldOpacity, 0);
  assert.ok(day.sunIntensity > 2.0);
});

test('golden hour preset captures warm dusk atmosphere', () => {
  const dusk = computeAtmosphereState(TIME_OF_DAY_PRESETS.dusk);
  assert.equal(dusk.presetLabel, 'Golden Hour');
  assert.ok(dusk.duskFactor > 0.5);
  assert.ok(dusk.nightFactor > 0 && dusk.nightFactor < 0.7);
});

test('night preset activates spire illumination, uplights, starfield, and city lights', () => {
  const night = computeAtmosphereState(TIME_OF_DAY_PRESETS.night);
  assert.equal(night.presetLabel, 'Night');
  assert.ok(night.nightFactor > 0.9);
  assert.ok(night.spireGlowIntensity > 0.9);
  assert.ok(night.uplightIntensity > 0.9);
  assert.ok(night.eixampleWindowGlow > 0.9);
  assert.ok(night.starfieldOpacity > 0.85);
  assert.ok(night.windowGlowBoost > 1.2);
});

test('time of day wraps cleanly around 0..1 boundary', () => {
  assert.equal(normalizeTimeOfDay(-0.42).toFixed(2), '0.58');
  assert.equal(resolveTimeOfDayPreset(1.0), 'day');
  assert.equal(resolveTimeOfDayPreset(0.58), 'night');
});
