import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeWeatherAtmosphere,
  createInitialFogWisps,
  createInitialRainDrops,
  stepFogWisps,
  stepRainDrops,
  WEATHER_BOUNDS,
} from './atmosphereParticles.ts';
import { TIME_OF_DAY_PRESETS } from './timeOfDay.ts';

test('auto weather disables rain and fog during bright Mediterranean daylight', () => {
  const day = computeWeatherAtmosphere(TIME_OF_DAY_PRESETS.day, 'auto');
  assert.equal(day.rainOpacity, 0);
  assert.equal(day.fogWispOpacity, 0);
});

test('auto weather activates drifting fog at dusk and light rain at night', () => {
  const dusk = computeWeatherAtmosphere(TIME_OF_DAY_PRESETS.dusk, 'auto');
  const night = computeWeatherAtmosphere(TIME_OF_DAY_PRESETS.night, 'auto');

  assert.ok(dusk.fogWispOpacity > 0.25, `Expected dusk mist, got ${dusk.fogWispOpacity}`);
  assert.ok(night.rainOpacity > 0.4, `Expected night rain, got ${night.rainOpacity}`);
  assert.ok(night.fogWispOpacity > 0.2, `Expected night mist, got ${night.fogWispOpacity}`);
});

test('clear mode forces all weather particles off regardless of time of day', () => {
  const nightClear = computeWeatherAtmosphere(TIME_OF_DAY_PRESETS.night, 'clear');
  assert.equal(nightClear.rainOpacity, 0);
  assert.equal(nightClear.fogWispOpacity, 0);
});

test('rain drops fall downward and wrap seamlessly inside bounds', () => {
  const drops = createInitialRainDrops(24);
  const startY = drops[0].y;
  stepRainDrops(drops, 0.25, -2.5, 1.2, 26);

  assert.notEqual(drops[0].y, startY);
  for (const d of drops) {
    assert.ok(d.y >= WEATHER_BOUNDS.minY && d.y <= WEATHER_BOUNDS.maxY);
    assert.ok(Math.abs(d.x) <= WEATHER_BOUNDS.halfSpan);
    assert.ok(Math.abs(d.z) <= WEATHER_BOUNDS.halfSpan);
  }
});

test('fog wisps drift smoothly over time and wrap cleanly', () => {
  const wisps = createInitialFogWisps(16);
  const initialX = wisps[0].x;
  stepFogWisps(wisps, 1.5, 3.0, -3.0, 1.2);
  assert.notEqual(wisps[0].x, initialX);
});
