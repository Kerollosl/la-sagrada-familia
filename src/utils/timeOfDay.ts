export type TimeOfDayPreset = 'day' | 'dusk' | 'night';

export const TIME_OF_DAY_PRESETS: Record<TimeOfDayPreset, number> = {
  day: 0.0,
  dusk: 0.25,
  night: 0.52,
};

export interface AtmosphereState {
  timeOfDay: number;
  presetLabel: 'Daylight' | 'Golden Hour' | 'Night';
  nightFactor: number;
  duskFactor: number;
  skyTopHex: number;
  skyMidHex: number;
  skyHorizonHex: number;
  fogColorHex: number;
  fogDensity: number;
  sunPosition: [number, number, number];
  sunColorHex: number;
  sunIntensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  rimColorHex: number;
  rimIntensity: number;
  envIntensity: number;
  toneMappingExposure: number;
  spireGlowIntensity: number;
  windowGlowBoost: number;
  uplightIntensity: number;
  eixampleWindowGlow: number;
  starfieldOpacity: number;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function lerpColorHex(hexA: number, hexB: number, t: number): number {
  const k = clamp01(t);
  const rA = (hexA >> 16) & 255;
  const gA = (hexA >> 8) & 255;
  const bA = hexA & 255;
  const rB = (hexB >> 16) & 255;
  const gB = (hexB >> 8) & 255;
  const bB = hexB & 255;
  const r = Math.round(lerp(rA, rB, k));
  const g = Math.round(lerp(gA, gB, k));
  const b = Math.round(lerp(bA, bB, k));
  return (r << 16) | (g << 8) | b;
}

export function normalizeTimeOfDay(raw: number): number {
  const mod = raw % 1;
  return mod < 0 ? mod + 1 : mod;
}

export function resolveTimeOfDayPreset(tod: number): TimeOfDayPreset {
  const n = normalizeTimeOfDay(tod);
  if (n >= 0.38 && n <= 0.70) return 'night';
  if ((n >= 0.16 && n < 0.38) || (n > 0.70 && n <= 0.88)) return 'dusk';
  return 'day';
}

export function computeAtmosphereState(rawTimeOfDay: number): AtmosphereState {
  const t = normalizeTimeOfDay(rawTimeOfDay);
  // 0.0 = Mediterranean noon daylight, 0.25 = Golden Hour, 0.52 = Deep Night, 0.75 = Dawn
  // Compute sun altitude wave: +1 at midday (0.0), 0 at horizon (0.25 / 0.75), -1 at midnight (0.50)
  const angle = t * Math.PI * 2;
  const daylightCos = Math.cos(angle); // +1 at 0, -1 at 0.5

  // Smooth night factor (0 during day, rises steeply after golden hour, 1 at night)
  const nightFactor = smoothstep(0.15, -0.45, daylightCos);

  // Golden hour & dawn warmth peaks around horizon crossing (daylightCos near 0.12)
  const duskFactor = Math.exp(-Math.pow((daylightCos - 0.12) / 0.38, 2)) * (1 - nightFactor * 0.65);

  // Sky palette interpolation: Clear Daylight -> Golden Hour -> Dramatic Night
  const dayTop = 0x4287d6;
  const dayMid = 0x8fc0ea;
  const dayHorizon = 0xdcebf7;

  const duskTop = 0x6b93c4;
  const duskMid = 0xd2c4c0;
  const duskHorizon = 0xf2c593;

  const nightTop = 0x060b19;
  const nightMid = 0x101c36;
  const nightHorizon = 0x1b2b4a;

  let skyTopHex = lerpColorHex(dayTop, duskTop, duskFactor);
  let skyMidHex = lerpColorHex(dayMid, duskMid, duskFactor);
  let skyHorizonHex = lerpColorHex(dayHorizon, duskHorizon, duskFactor);

  skyTopHex = lerpColorHex(skyTopHex, nightTop, nightFactor);
  skyMidHex = lerpColorHex(skyMidHex, nightMid, nightFactor);
  skyHorizonHex = lerpColorHex(skyHorizonHex, nightHorizon, nightFactor);

  // Sun / Moonlight arc
  const azimuth = 0.78 + t * Math.PI * 1.4;
  const sunElevRad = lerp(0.95, 0.22, clamp01(duskFactor * 0.9 + nightFactor * 0.3));
  const moonElevRad = 0.78;
  const activeElev = lerp(sunElevRad, moonElevRad, nightFactor);
  const dist = 78;
  const sunPosition: [number, number, number] = [
    Math.cos(azimuth) * Math.cos(activeElev) * dist,
    Math.sin(activeElev) * dist,
    Math.sin(azimuth) * Math.cos(activeElev) * dist,
  ];

  let sunColorHex = lerpColorHex(0xfff4e0, 0xffb86c, duskFactor);
  sunColorHex = lerpColorHex(sunColorHex, 0x6f97db, nightFactor);
  const sunIntensity = lerp(lerp(2.25, 1.95, duskFactor), 0.72, nightFactor);

  let hemiSkyHex = lerpColorHex(0x88bef0, 0x90a8cc, duskFactor);
  hemiSkyHex = lerpColorHex(hemiSkyHex, 0x263f6e, nightFactor);

  let hemiGroundHex = lerpColorHex(0x8a6d50, 0x6b5039, duskFactor);
  hemiGroundHex = lerpColorHex(hemiGroundHex, 0x171b26, nightFactor);
  const hemiIntensity = lerp(0.82, 0.34, nightFactor);

  let rimColorHex = lerpColorHex(0xa6ccf0, 0x9fc2e6, duskFactor);
  rimColorHex = lerpColorHex(rimColorHex, 0x4569a8, nightFactor);
  const rimIntensity = lerp(0.52, 0.42, nightFactor);

  const envIntensity = lerp(0.55, 0.16, nightFactor);
  const toneMappingExposure = lerp(0.96, 1.08, nightFactor);
  const fogDensity = lerp(0.0036, 0.0052, nightFactor);

  // Night architectural illumination for spires, finials, stained glass, and surrounding city
  const spireGlowIntensity = smoothstep(0.18, 0.88, nightFactor);
  const windowGlowBoost = smoothstep(0.12, 0.85, nightFactor) * 1.55 + duskFactor * 0.35;
  const uplightIntensity = smoothstep(0.2, 0.9, nightFactor);
  const eixampleWindowGlow = smoothstep(0.28, 0.92, nightFactor);
  const starfieldOpacity = smoothstep(0.45, 0.95, nightFactor);

  const preset = resolveTimeOfDayPreset(t);
  const presetLabel =
    preset === 'day' ? 'Daylight' : preset === 'dusk' ? 'Golden Hour' : 'Night';

  return {
    timeOfDay: t,
    presetLabel,
    nightFactor,
    duskFactor,
    skyTopHex,
    skyMidHex,
    skyHorizonHex,
    fogColorHex: skyHorizonHex,
    fogDensity,
    sunPosition,
    sunColorHex,
    sunIntensity,
    hemiSkyHex,
    hemiGroundHex,
    hemiIntensity,
    rimColorHex,
    rimIntensity,
    envIntensity,
    toneMappingExposure,
    spireGlowIntensity,
    windowGlowBoost,
    uplightIntensity,
    eixampleWindowGlow,
    starfieldOpacity,
  };
}
