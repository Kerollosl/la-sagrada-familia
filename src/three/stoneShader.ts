import * as THREE from 'three';

export type StoneReliefProfile = 'organic' | 'angular';

export interface StoneHeightfieldConfig {
  size: number;
  profile: StoneReliefProfile;
  normalStrength?: number;
}

export interface StoneTextureBuffers {
  size: number;
  albedoData: Uint8Array;
  normalData: Uint8Array;
  displacementData: Uint8Array;
  roughnessData: Uint8Array;
}

export interface StonePBRTextureSet {
  albedoMap: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  displacementMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
  textures: THREE.Texture[];
}

function clampByte(v: number): number {
  if (v <= 0) return 0;
  if (v >= 255) return 255;
  return Math.round(v);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function fract(x: number): number {
  return x - Math.floor(x);
}

/** Deterministic integer hash on a periodic integer lattice [0, period). */
function hash2i(ix: number, iy: number, period: number, seed: number): number {
  const px = ((ix % period) + period) % period;
  const py = ((iy % period) + period) % period;
  let h = (px * 374761393 + py * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}

/** Seamless tileable periodic value noise across u, v in [0, 1). */
export function periodicNoise(
  u: number,
  v: number,
  periodX: number,
  periodY: number,
  seed: number
): number {
  const fx = u * periodX;
  const fy = v * periodY;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);

  const ix1 = ix + 1;
  const iy1 = iy + 1;

  let v00: number;
  let v10: number;
  let v01: number;
  let v11: number;

  if (periodX === periodY) {
    v00 = hash2i(ix, iy, periodX, seed);
    v10 = hash2i(ix1, iy, periodX, seed);
    v01 = hash2i(ix, iy1, periodX, seed);
    v11 = hash2i(ix1, iy1, periodX, seed);
  } else {
    const wx0 = ((ix % periodX) + periodX) % periodX;
    const wx1 = ((ix1 % periodX) + periodX) % periodX;
    const wy0 = ((iy % periodY) + periodY) % periodY;
    const wy1 = ((iy1 % periodY) + periodY) % periodY;
    v00 = hash2i(wx0, wy0, 65536, seed);
    v10 = hash2i(wx1, wy0, 65536, seed);
    v01 = hash2i(wx0, wy1, 65536, seed);
    v11 = hash2i(wx1, wy1, 65536, seed);
  }

  const nx0 = v00 + (v10 - v00) * sx;
  const nx1 = v01 + (v11 - v01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

function periodicFbm(u: number, v: number, basePeriod: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let p = basePeriod;
  for (let o = 0; o < 4; o++) {
    sum += periodicNoise(u, v, p, p, seed + o * 79) * amp;
    norm += amp;
    amp *= 0.5;
    p *= 2;
  }
  return sum / norm;
}

/**
 * Generates high-resolution tileable procedural heightfield & PBR buffers
 * (albedo weathering, Sobel tangent-space normal map, displacement map, roughness map).
 */
export function generateStoneTextureBuffers(
  config: StoneHeightfieldConfig
): StoneTextureBuffers {
  const size = config.size;
  const profile = config.profile;
  const normalStrength = config.normalStrength ?? (profile === 'organic' ? 3.8 : 4.2);

  const total = size * size;
  const heightField = new Float32Array(total);
  const mortarMask = new Float32Array(total);
  const carvingMask = new Float32Array(total);

  const rows = profile === 'organic' ? 16 : 12;
  const cols = profile === 'organic' ? 8 : 6;
  const TAU = Math.PI * 2;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const rowF = v * rows;
    const rowIdx = Math.floor(rowF);
    const rowLocal = rowF - rowIdx;
    const rowStagger = (rowIdx % 2) * 0.5;

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const colF = u * cols + rowStagger;
      const colIdx = Math.floor(colF) % cols;
      const colLocal = fract(colF);

      const blockSeed = hash2i(colIdx, rowIdx, 256, profile === 'organic' ? 17 : 91);
      const blockRelief = (blockSeed - 0.5) * 0.14;

      // Crisp chamfered ashlar mortar groove along block boundaries
      const edgeY = Math.min(rowLocal, 1 - rowLocal);
      const edgeX = Math.min(colLocal, 1 - colLocal);
      const jointWidthY = profile === 'organic' ? 0.085 : 0.055;
      const jointWidthX = profile === 'organic' ? 0.055 : 0.04;
      const maskY = smoothstep(0.015, jointWidthY, edgeY);
      const maskX = smoothstep(0.01, jointWidthX, edgeX);
      const blockFace = maskX * maskY;
      const mortarDepth = 1 - blockFace;

      // Multi-octave weathered limestone grain & rainwater erosion streaks
      const fbmMacro = periodicFbm(u, v, 16, profile === 'organic' ? 101 : 211);
      const fbmMicro = periodicFbm(u, v, 64, profile === 'organic' ? 307 : 409);
      const rainStreak = periodicNoise(u, v * 0.25, 48, 12, 503);

      let relief = 0;
      let carveHighlight = 0;

      if (profile === 'organic') {
        // Gaudí carved stone fluting, naturalistic botanical waves & weathered pits
        const flute = Math.sin((u * cols * 4 + fbmMacro * 0.65) * TAU) * 0.045;
        const isCarvedBand = rowIdx % 4 === 1 || rowIdx % 4 === 3;
        const dx = colLocal - 0.5;
        const dy = rowLocal - 0.5;
        const rad = Math.hypot(dx * 1.15, dy * 1.65);
        const ang = Math.atan2(dy, dx);
        const rosette = isCarvedBand
          ? Math.max(0, 1 - rad * 2.25) * (0.55 + 0.45 * Math.cos(ang * 6)) * 0.16
          : 0;

        // Travertine erosion micro-pitting
        const pitRaw = periodicNoise(u, v, 128, 128, 613);
        const pit = pitRaw < 0.22 ? -(0.22 - pitRaw) * 0.42 : 0;

        relief =
          0.56 +
          blockRelief +
          (fbmMacro - 0.5) * 0.19 +
          (fbmMicro - 0.5) * 0.11 +
          (rainStreak - 0.5) * 0.08 +
          flute * blockFace +
          rosette * blockFace +
          pit -
          mortarDepth * 0.34;
        carveHighlight = rosette * 2.2 + Math.max(0, flute) * 1.4;
      } else {
        // Subirachs Passion Facade: angular chisel striations, geometric stepped facets & tool marks
        const diagChisel =
          Math.sin((u * 18 + v * 30 + blockSeed * 4) * TAU) * 0.032 +
          Math.sin((u * 42 - v * 24) * TAU) * 0.018;
        const facetSlope = (colLocal - 0.5) * ((blockSeed > 0.5 ? 1 : -1) * 0.09);
        const pitRaw = periodicNoise(u, v, 128, 128, 719);
        const pit = pitRaw < 0.14 ? -(0.14 - pitRaw) * 0.28 : 0;

        relief =
          0.54 +
          blockRelief * 0.85 +
          facetSlope * blockFace +
          diagChisel * blockFace +
          (fbmMacro - 0.5) * 0.14 +
          (fbmMicro - 0.5) * 0.1 +
          (rainStreak - 0.5) * 0.05 +
          pit -
          mortarDepth * 0.3;
        carveHighlight = Math.max(0, facetSlope * 1.5 + diagChisel * 1.2);
      }

      const idx = y * size + x;
      heightField[idx] = Math.max(0.02, Math.min(0.98, relief));
      mortarMask[idx] = mortarDepth;
      carvingMask[idx] = carveHighlight;
    }
  }

  const albedoData = new Uint8Array(total * 4);
  const normalData = new Uint8Array(total * 4);
  const displacementData = new Uint8Array(total * 4);
  const roughnessData = new Uint8Array(total * 4);

  const sampleH = (px: number, py: number): number => {
    const wx = ((px % size) + size) % size;
    const wy = ((py % size) + size) % size;
    return heightField[wy * size + wx];
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const p4 = idx * 4;
      const h = heightField[idx];
      const mortar = mortarMask[idx];
      const carve = carvingMask[idx];

      // 3x3 Sobel gradient with toroidal wrap for seamless tileable tangent-space normals
      const tl = sampleH(x - 1, y - 1);
      const tc = sampleH(x, y - 1);
      const tr = sampleH(x + 1, y - 1);
      const ml = sampleH(x - 1, y);
      const mr = sampleH(x + 1, y);
      const bl = sampleH(x - 1, y + 1);
      const bc = sampleH(x, y + 1);
      const br = sampleH(x + 1, y + 1);

      const dX = (tr + 2 * mr + br - (tl + 2 * ml + bl)) * 0.25 * normalStrength;
      const dY = (bl + 2 * bc + br - (tl + 2 * tc + tr)) * 0.25 * normalStrength;

      const nx = -dX;
      const ny = -dY;
      const nz = 1.0;
      const invLen = 1 / Math.hypot(nx, ny, nz);

      normalData[p4] = clampByte((nx * invLen * 0.5 + 0.5) * 255);
      normalData[p4 + 1] = clampByte((ny * invLen * 0.5 + 0.5) * 255);
      normalData[p4 + 2] = clampByte((nz * invLen * 0.5 + 0.5) * 255);
      normalData[p4 + 3] = 255;

      // Displacement byte (centered near 128 so displacementBias = -0.5 * scale keeps nominal profile)
      const dispByte = clampByte(h * 255);
      displacementData[p4] = dispByte;
      displacementData[p4 + 1] = dispByte;
      displacementData[p4 + 2] = dispByte;
      displacementData[p4 + 3] = 255;

      // Roughness byte: recessed mortar & weathered pockets are matte; carved limestone crests slightly smoother
      const roughVal = Math.max(0.56, Math.min(0.98, 0.86 - (h - 0.5) * 0.34 + mortar * 0.12 - carve * 0.08));
      const roughByte = clampByte(roughVal * 255);
      roughnessData[p4] = roughByte;
      roughnessData[p4 + 1] = roughByte;
      roughnessData[p4 + 2] = roughByte;
      roughnessData[p4 + 3] = 255;

      // Albedo weathering map (multiplies cleanly with architectural stone color tint)
      const aoCrevice = 1.0 - mortar * 0.34;
      const crestLift = (h - 0.5) * 0.24 + carve * 0.09;
      const baseTone = (0.87 + crestLift) * aoCrevice;
      const warmPatina = profile === 'organic' ? (1 - mortar) * 0.015 : 0;

      albedoData[p4] = clampByte((baseTone + warmPatina) * 255);
      albedoData[p4 + 1] = clampByte((baseTone - 0.008) * 255);
      albedoData[p4 + 2] = clampByte((baseTone - 0.028 - warmPatina * 0.5) * 255);
      albedoData[p4 + 3] = 255;
    }
  }

  return { size, albedoData, normalData, displacementData, roughnessData };
}

function createTiledDataTexture(
  data: Uint8Array,
  size: number,
  isColor: boolean,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number
): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createStonePBRTextureSet(
  profile: StoneReliefProfile,
  maxAnisotropy: number,
  size = 1024,
  repeatX = 3,
  repeatY = 5
): StonePBRTextureSet {
  const buffers = generateStoneTextureBuffers({ size, profile });
  const albedoMap = createTiledDataTexture(
    buffers.albedoData,
    size,
    true,
    repeatX,
    repeatY,
    maxAnisotropy
  );
  const normalMap = createTiledDataTexture(
    buffers.normalData,
    size,
    false,
    repeatX,
    repeatY,
    maxAnisotropy
  );
  const displacementMap = createTiledDataTexture(
    buffers.displacementData,
    size,
    false,
    repeatX,
    repeatY,
    maxAnisotropy
  );
  const roughnessMap = createTiledDataTexture(
    buffers.roughnessData,
    size,
    false,
    repeatX,
    repeatY,
    maxAnisotropy
  );

  return {
    albedoMap,
    normalMap,
    displacementMap,
    roughnessMap,
    textures: [albedoMap, normalMap, displacementMap, roughnessMap],
  };
}

export function buildStoneShaderSnippets(profile: StoneReliefProfile) {
  const grainScale = profile === 'organic' ? '9.5' : '11.5';
  const patinaStrength = profile === 'organic' ? '0.075' : '0.045';
  const microNormalAmp = profile === 'organic' ? '0.085' : '0.105';

  return {
    cacheKey: `sagrada-stone-pbr-${profile}-v2`,
    vertexPars: `
      varying vec3 vStoneWorldPos;
      varying vec3 vStoneWorldNormal;
    `,
    vertexWorldCompute: `
      #include <displacementmap_vertex>
      vec4 stoneWp = modelMatrix * vec4(transformed, 1.0);
      vStoneWorldPos = stoneWp.xyz;
      vStoneWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
    `,
    fragmentPars: `
      varying vec3 vStoneWorldPos;
      varying vec3 vStoneWorldNormal;
      float stoneStrataNoise(vec3 p) {
        float w1 = sin(p.y * 4.6 + sin(p.x * 0.95 + p.z * 0.85) * 0.75);
        float w2 = sin(p.x * 2.7 + p.z * 2.5 + sin(p.y * 1.4) * 0.5);
        return w1 * 0.55 + w2 * 0.45;
      }
    `,
    fragmentColor: `
      #include <color_fragment>
      float strata = stoneStrataNoise(vStoneWorldPos);
      float streak = sin(vStoneWorldPos.x * 3.4 + vStoneWorldPos.z * 3.1 + strata * 0.65) * 0.5 + 0.5;
      float upFacing = smoothstep(0.15, 0.85, vStoneWorldNormal.y);
      float weatheringDark = (1.0 - upFacing * 0.45) * (${patinaStrength} * (0.45 + 0.55 * streak));
      float limestoneDust = upFacing * 0.045 + strata * 0.025;
      diffuseColor.rgb *= (1.0 - weatheringDark + limestoneDust);
    `,
    fragmentNormal: `
      #include <normal_fragment_maps>
      vec3 sp = vStoneWorldPos * ${grainScale};
      vec3 microGrad = vec3(
        cos(sp.x * 1.7 + sin(sp.y * 1.3 + sp.z * 1.1)),
        cos(sp.y * 1.9 + sin(sp.z * 1.4 + sp.x * 1.2)),
        cos(sp.z * 1.7 + sin(sp.x * 1.3 + sp.y * 1.1))
      );
      vec3 viewMicro = normalize((viewMatrix * vec4(microGrad, 0.0)).xyz + vec3(0.0001));
      normal = normalize(normal + (viewMicro - normal * dot(viewMicro, normal)) * ${microNormalAmp});
    `,
  };
}

/**
 * Enhances a stone MeshStandardMaterial with world-space sedimentary weathering,
 * rainwater patina streaks, and micro-crystalline normal perturbation on top of
 * its 1024x1024 tangent-space normalMap, displacementMap, and roughnessMap.
 */
export function applyWeatheredStoneShader(
  material: THREE.MeshStandardMaterial,
  profile: StoneReliefProfile
): THREE.MeshStandardMaterial {
  const snippets = buildStoneShaderSnippets(profile);
  material.customProgramCacheKey = () => snippets.cacheKey;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${snippets.vertexPars}`)
      .replace('#include <displacementmap_vertex>', snippets.vertexWorldCompute);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${snippets.fragmentPars}`)
      .replace('#include <color_fragment>', snippets.fragmentColor)
      .replace('#include <normal_fragment_maps>', snippets.fragmentNormal);
  };
  material.needsUpdate = true;
  return material;
}
