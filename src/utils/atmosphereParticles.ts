import { computeAtmosphereState } from './timeOfDay';

export type WeatherMode = 'auto' | 'rain' | 'fog' | 'clear';

export interface WeatherAtmosphere {
  mode: WeatherMode;
  rainOpacity: number;
  rainDensity: number; // 0..1 active fraction of drops
  fogWispOpacity: number;
  windX: number;
  windZ: number;
  rainSpeed: number;
}

export interface RainDropState {
  x: number;
  y: number;
  z: number;
  speed: number;
  length: number;
}

export interface FogWispState {
  x: number;
  y: number;
  z: number;
  phase: number;
  speed: number;
  driftRadius: number;
}

export const WEATHER_BOUNDS = {
  halfSpan: 48,
  maxY: 56,
  minY: 0,
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Computes light rain & drifting fog intensities for the active Time of Day and WeatherMode.
 * - 'auto': Clear Mediterranean air in daylight, drifting evening mist at dusk, and light rain + mist at night.
 * - 'rain': Gentle rain showers + light mist regardless of time of day (brighter/subtler by day, rich at dusk/night).
 * - 'fog': Drifting atmospheric mist wisps around plaza and mid-towers.
 * - 'clear': Disables both precipitation and drifting mist particles.
 */
export function computeWeatherAtmosphere(
  timeOfDay: number,
  mode: WeatherMode = 'auto'
): WeatherAtmosphere {
  const atmos = computeAtmosphereState(timeOfDay);
  const duskOrNight = clamp01(atmos.duskFactor * 0.85 + atmos.nightFactor);

  let rainOpacity = 0;
  let rainDensity = 0;
  let fogWispOpacity = 0;

  if (mode === 'auto') {
    // At dusk: gentle drifting mist + very light twilight drizzle
    // At night: atmospheric light rain + lingering low mist
    const duskMist = smoothstep(0.08, 0.45, atmos.duskFactor) * 0.42;
    const nightMist = smoothstep(0.08, 0.4, atmos.nightFactor) * 0.34;
    fogWispOpacity = clamp01(Math.max(duskMist, nightMist));

    const nightRain = smoothstep(0.25, 0.9, atmos.nightFactor) * 0.43;
    const duskDrizzle = smoothstep(0.45, 0.95, atmos.duskFactor) * 0.15;
    rainOpacity = clamp01(Math.max(nightRain, duskDrizzle));
    rainDensity = clamp01(
      smoothstep(0.15, 0.9, atmos.nightFactor) * 0.95 +
        smoothstep(0.35, 0.95, atmos.duskFactor) * 0.35
    );
  } else if (mode === 'rain') {
    rainOpacity = 0.32 + duskOrNight * 0.24;
    rainDensity = 1.0;
    fogWispOpacity = 0.18 + duskOrNight * 0.2;
  } else if (mode === 'fog') {
    rainOpacity = 0;
    rainDensity = 0;
    fogWispOpacity = 0.38 + duskOrNight * 0.22;
  }

  return {
    mode,
    rainOpacity,
    rainDensity,
    fogWispOpacity,
    windX: -2.4 - atmos.nightFactor * 1.4,
    windZ: 1.1 + atmos.duskFactor * 0.7,
    rainSpeed: 24 + atmos.nightFactor * 6,
  };
}

export function createInitialRainDrops(count: number): RainDropState[] {
  const drops: RainDropState[] = [];
  const span = WEATHER_BOUNDS.halfSpan * 2;
  for (let i = 0; i < count; i++) {
    const h1 = (Math.sin(i * 12.9898 + 0.5) * 43758.5453) % 1;
    const h2 = (Math.sin(i * 78.233 + 1.7) * 24634.6345) % 1;
    const h3 = (Math.sin(i * 39.425 + 3.1) * 19283.4712) % 1;
    const r1 = h1 < 0 ? h1 + 1 : h1;
    const r2 = h2 < 0 ? h2 + 1 : h2;
    const r3 = h3 < 0 ? h3 + 1 : h3;

    drops.push({
      x: (r1 - 0.5) * span,
      y: r2 * WEATHER_BOUNDS.maxY,
      z: (r3 - 0.5) * span,
      speed: 0.85 + ((i % 7) / 7) * 0.35,
      length: 1.35 + ((i % 5) / 5) * 0.95,
    });
  }
  return drops;
}

export function stepRainDrops(
  drops: RainDropState[],
  dt: number,
  windX: number,
  windZ: number,
  baseSpeed: number
): void {
  const half = WEATHER_BOUNDS.halfSpan;
  const span = half * 2;
  const maxY = WEATHER_BOUNDS.maxY;

  for (let i = 0; i < drops.length; i++) {
    const d = drops[i];
    const vy = baseSpeed * d.speed;
    d.x += windX * dt;
    d.z += windZ * dt;
    d.y -= vy * dt;

    if (d.y < WEATHER_BOUNDS.minY) {
      d.y += maxY;
    }
    if (d.x < -half) d.x += span;
    else if (d.x > half) d.x -= span;
    if (d.z < -half) d.z += span;
    else if (d.z > half) d.z -= span;
  }
}

export function createInitialFogWisps(count: number): FogWispState[] {
  const wisps: FogWispState[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 * 2.7;
    const radius = 10 + ((i * 19) % 36);
    const layerY = 1.6 + ((i * 13) % 24);
    wisps.push({
      x: Math.cos(angle) * radius,
      y: layerY,
      z: Math.sin(angle) * radius,
      phase: i * 0.73,
      speed: 0.6 + ((i % 6) / 6) * 0.7,
      driftRadius: 0.8 + ((i % 4) / 4) * 1.1,
    });
  }
  return wisps;
}

export function stepFogWisps(
  wisps: FogWispState[],
  dt: number,
  elapsed: number,
  windX: number,
  windZ: number
): void {
  const half = WEATHER_BOUNDS.halfSpan + 8;
  const span = half * 2;
  for (let i = 0; i < wisps.length; i++) {
    const w = wisps[i];
    w.x += (windX * 0.55 * w.speed + Math.sin(elapsed * 0.35 + w.phase) * 0.25) * dt;
    w.z += (windZ * 0.55 * w.speed + Math.cos(elapsed * 0.28 + w.phase) * 0.25) * dt;
    if (w.x < -half) w.x += span;
    else if (w.x > half) w.x -= span;
    if (w.z < -half) w.z += span;
    else if (w.z > half) w.z -= span;
  }
}
