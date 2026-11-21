import * as THREE from 'three';
import {
  applyWeatheredStoneShader,
  createStonePBRTextureSet,
  StoneReliefProfile,
} from './stoneShader';

export interface PhaseClipPlanes {
  crypt: THREE.Plane;
  apse: THREE.Plane;
  nativityBody: THREE.Plane;
  nativityTowers: THREE.Plane;
  passionBody: THREE.Plane;
  passionTowers: THREE.Plane;
  naveWalls: THREE.Plane;
  naveVaults: THREE.Plane;
  evangelistTowers: THREE.Plane;
  virginMaryTower: THREE.Plane;
  jesusTower: THREE.Plane;
  gloryFacade: THREE.Plane;
}

export interface BasilicaMaterials {
  clipPlanes: PhaseClipPlanes;
  stoneCrypt: THREE.MeshStandardMaterial;
  stoneApse: THREE.MeshStandardMaterial;
  stoneNativityBody: THREE.MeshStandardMaterial;
  stoneNativityTowers: THREE.MeshStandardMaterial;
  finialNativityGold: THREE.MeshStandardMaterial;
  finialCypress: THREE.MeshStandardMaterial;
  finialWhiteCeramic: THREE.MeshStandardMaterial;
  trencadisNativity: THREE.MeshStandardMaterial;
  trencadisVirginMary: THREE.MeshStandardMaterial;
  bronzeNativity: THREE.MeshStandardMaterial;
  bronzePassion: THREE.MeshStandardMaterial;
  bronzeGlory: THREE.MeshStandardMaterial;

  stonePassionBody: THREE.MeshStandardMaterial;
  stonePassionTowers: THREE.MeshStandardMaterial;
  finialPassion: THREE.MeshStandardMaterial;

  stoneNaveWalls: THREE.MeshStandardMaterial;
  stoneNaveVaults: THREE.MeshStandardMaterial;
  roofTerracotta: THREE.MeshStandardMaterial;
  stainedGlass: THREE.MeshStandardMaterial;

  stoneEvangelists: THREE.MeshStandardMaterial;
  finialEvangelists: THREE.MeshStandardMaterial;
  stoneVirginMary: THREE.MeshStandardMaterial;
  starVirginMary: THREE.MeshPhysicalMaterial;
  stoneJesusTower: THREE.MeshStandardMaterial;
  crossJesusTower: THREE.MeshPhysicalMaterial;
  stoneGloryFacade: THREE.MeshStandardMaterial;

  shadowRecessCrypt: THREE.MeshStandardMaterial;
  shadowRecessApse: THREE.MeshStandardMaterial;
  shadowRecessNativity: THREE.MeshStandardMaterial;
  shadowRecessPassion: THREE.MeshStandardMaterial;
  shadowRecessNave: THREE.MeshStandardMaterial;
  shadowRecessEvan: THREE.MeshStandardMaterial;
  shadowRecessMary: THREE.MeshStandardMaterial;
  shadowRecessJesus: THREE.MeshStandardMaterial;
  shadowRecessGlory: THREE.MeshStandardMaterial;

  craneMast: THREE.MeshStandardMaterial;
  craneAccent: THREE.MeshStandardMaterial;
  scaffoldRing: THREE.MeshStandardMaterial;

  plazaStone: THREE.MeshStandardMaterial;
  plazaCurb: THREE.MeshStandardMaterial;
  poolWater: THREE.MeshPhysicalMaterial;
  roadAsphalt: THREE.MeshStandardMaterial;
  eixampleBuilding: THREE.MeshStandardMaterial;
  eixampleRoof: THREE.MeshStandardMaterial;
  eixampleTrim: THREE.MeshStandardMaterial;
  hillsDistant: THREE.MeshStandardMaterial;
  treeTrunk: THREE.MeshStandardMaterial;
  treeFoliage: THREE.MeshStandardMaterial;
  cypressFoliage: THREE.MeshStandardMaterial;
  lampIron: THREE.MeshStandardMaterial;
  lampGlow: THREE.MeshStandardMaterial;
  birdFeather: THREE.MeshStandardMaterial;
  contactShadow: THREE.MeshBasicMaterial;

  textures: THREE.Texture[];
  dispose: () => void;
}



function createTrencadisCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e7dfd0';
  ctx.fillRect(0, 0, 256, 256);

  const shards = ['#f5b82e', '#d97706', '#2563eb', '#0d9488', '#e11d48', '#fef3c7', '#fbbf24'];
  const step = 16;
  for (let y = 0; y < 256; y += step) {
    for (let x = 0; x < 256; x += step) {
      const hash = ((x * 31 + y * 57) >> 3) % shards.length;
      ctx.fillStyle = shards[hash];
      const pad = 1.5 + ((x + y) % 3) * 0.5;
      ctx.fillRect(x + pad, y + pad, step - pad * 2, step - pad * 2);
    }
  }
  return canvas;
}

function createPlazaTileCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#c8baa6';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle Barcelona panot-inspired octagonal pavers
  const step = 32;
  for (let y = 0; y < 512; y += step) {
    for (let x = 0; x < 512; x += step) {
      const shade = (x / step + y / step) % 2 === 0 ? '#cec0ac' : '#c0b29e';
      ctx.fillStyle = shade;
      ctx.fillRect(x + 1, y + 1, step - 2, step - 2);
      ctx.strokeStyle = 'rgba(105, 92, 74, 0.22)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 5, y + 5, step - 10, step - 10);
    }
  }
  ctx.strokeStyle = 'rgba(84, 72, 56, 0.38)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 512; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  return canvas;
}

function createStreetGridCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Urban Mediterranean asphalt base
  ctx.fillStyle = '#686e75';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle stone/asphalt grain
  for (let i = 0; i < 4000; i++) {
    const px = (i * 193 + (i % 11) * 37) % 512;
    const py = (i * 271 + (i % 13) * 23) % 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(20,24,28,0.05)';
    ctx.fillRect(px, py, 2, 2);
  }

  // Pedestrian zebra crosswalk bands near center tile edges (matches 33-unit Eixample grid)
  ctx.fillStyle = 'rgba(232, 234, 236, 0.38)';
  for (let s = 88; s <= 156; s += 12) {
    ctx.fillRect(s, 14, 6, 22);
    ctx.fillRect(512 - s - 6, 476, 6, 22);
    ctx.fillRect(14, s, 22, 6);
    ctx.fillRect(476, 512 - s - 6, 22, 6);
  }

  // Dashed avenue lane dividers
  ctx.fillStyle = 'rgba(235, 235, 230, 0.24)';
  for (let p = 44; p < 470; p += 28) {
    ctx.fillRect(254, p, 4, 14);
    ctx.fillRect(p, 254, 14, 4);
  }
  return canvas;
}

function createEixampleFacadeCanvas(): {
  albedoCanvas: HTMLCanvasElement;
  emissiveCanvas: HTMLCanvasElement;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#d8c7b0';
  ctx.fillRect(0, 0, 512, 256);

  const eCanvas = document.createElement('canvas');
  eCanvas.width = 512;
  eCanvas.height = 256;
  const ectx = eCanvas.getContext('2d')!;
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, 512, 256);

  const cols = 16;
  const rows = 6;
  const w = 512 / cols;
  const h = 256 / rows;

  // Ground-floor commercial stone arcade base
  ctx.fillStyle = '#b9a892';
  ctx.fillRect(0, 5 * h, 512, h);

  for (let r = 0; r < rows; r++) {
    ctx.fillStyle = 'rgba(118, 98, 76, 0.32)';
    ctx.fillRect(0, r * h, 512, 3);
    for (let c = 0; c < cols; c++) {
      const x = c * w + 7;
      const y = r * h + 8;
      // Window frame & glass
      ctx.fillStyle = (r + c) % 5 === 0 ? '#5b6672' : '#3e464f';
      ctx.fillRect(x, y, w - 14, h - 16);
      // Wrought-iron balcony rail & warm stone sill
      ctx.fillStyle = '#c4ab8e';
      ctx.fillRect(x - 2, y + h - 17, w - 10, 3);
      ctx.fillStyle = 'rgba(42, 46, 52, 0.55)';
      ctx.fillRect(x - 1, y + h - 20, w - 12, 2);

      const litHash = (r * 19 + c * 31 + 7) % 10;
      if (litHash < 6) {
        ectx.fillStyle = litHash % 2 === 0 ? '#ffd188' : '#f4b560';
        ectx.fillRect(x + 1, y + 1, w - 16, h - 18);
      }
    }
  }
  return { albedoCanvas: canvas, emissiveCanvas: eCanvas };
}

function createStainedGlassCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const palette = [
    '#f59e0b',
    '#ea580c',
    '#dc2626',
    '#eab308',
    '#10b981',
    '#0284c7',
    '#4f46e5',
  ];

  const cols = 6;
  const rows = 14;
  const w = 256 / cols;
  const h = 512 / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = (r * 3 + c * 5) % palette.length;
      ctx.fillStyle = palette[idx];
      ctx.fillRect(c * w + 2, r * h + 2, w - 4, h - 4);
    }
  }
  ctx.strokeStyle = '#221a14';
  ctx.lineWidth = 6;
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath();
    ctx.moveTo(c * w, 0);
    ctx.lineTo(c * w, 512);
    ctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * h);
    ctx.lineTo(256, r * h);
    ctx.stroke();
  }
  return canvas;
}

function createContactShadowCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 22, 128, 128, 126);
  grad.addColorStop(0, 'rgba(34, 26, 18, 0.65)');
  grad.addColorStop(0.55, 'rgba(34, 26, 18, 0.32)');
  grad.addColorStop(1, 'rgba(34, 26, 18, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  return canvas;
}

export function createBasilicaMaterials(maxAnisotropy: number): BasilicaMaterials {
  const textures: THREE.Texture[] = [];

  // High-resolution 1024x1024 procedural PBR stone sets (normal, displacement, roughness & weathered albedo)
  const organicStoneTex = createStonePBRTextureSet('organic', maxAnisotropy, 1024, 3, 5);
  const angularStoneTex = createStonePBRTextureSet('angular', maxAnisotropy, 1024, 3, 5);
  textures.push(...organicStoneTex.textures, ...angularStoneTex.textures);

  const trencadisTex = new THREE.CanvasTexture(createTrencadisCanvas());
  trencadisTex.colorSpace = THREE.SRGBColorSpace;
  trencadisTex.wrapS = THREE.RepeatWrapping;
  trencadisTex.wrapT = THREE.RepeatWrapping;
  trencadisTex.anisotropy = maxAnisotropy;
  textures.push(trencadisTex);

  const plazaColorTex = new THREE.CanvasTexture(createPlazaTileCanvas());
  plazaColorTex.colorSpace = THREE.SRGBColorSpace;
  plazaColorTex.wrapS = THREE.RepeatWrapping;
  plazaColorTex.wrapT = THREE.RepeatWrapping;
  plazaColorTex.repeat.set(18, 18);
  plazaColorTex.anisotropy = maxAnisotropy;
  textures.push(plazaColorTex);

  const streetGridTex = new THREE.CanvasTexture(createStreetGridCanvas());
  streetGridTex.colorSpace = THREE.SRGBColorSpace;
  streetGridTex.wrapS = THREE.RepeatWrapping;
  streetGridTex.wrapT = THREE.RepeatWrapping;
  streetGridTex.repeat.set(14, 14);
  streetGridTex.anisotropy = maxAnisotropy;
  textures.push(streetGridTex);

  const eixampleCanvases = createEixampleFacadeCanvas();
  const eixampleFacadeTex = new THREE.CanvasTexture(eixampleCanvases.albedoCanvas);
  eixampleFacadeTex.colorSpace = THREE.SRGBColorSpace;
  eixampleFacadeTex.wrapS = THREE.RepeatWrapping;
  eixampleFacadeTex.wrapT = THREE.RepeatWrapping;
  eixampleFacadeTex.repeat.set(2, 1);
  eixampleFacadeTex.anisotropy = maxAnisotropy;
  textures.push(eixampleFacadeTex);

  const eixampleEmissiveTex = new THREE.CanvasTexture(eixampleCanvases.emissiveCanvas);
  eixampleEmissiveTex.colorSpace = THREE.SRGBColorSpace;
  eixampleEmissiveTex.wrapS = THREE.RepeatWrapping;
  eixampleEmissiveTex.wrapT = THREE.RepeatWrapping;
  eixampleEmissiveTex.repeat.set(2, 1);
  eixampleEmissiveTex.anisotropy = maxAnisotropy;
  textures.push(eixampleEmissiveTex);

  const stainedGlassTex = new THREE.CanvasTexture(createStainedGlassCanvas());
  stainedGlassTex.colorSpace = THREE.SRGBColorSpace;
  stainedGlassTex.anisotropy = maxAnisotropy;
  textures.push(stainedGlassTex);

  const shadowTex = new THREE.CanvasTexture(createContactShadowCanvas());
  textures.push(shadowTex);

  const makeClipPlane = () => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);

  const clipPlanes: PhaseClipPlanes = {
    crypt: makeClipPlane(),
    apse: makeClipPlane(),
    nativityBody: makeClipPlane(),
    nativityTowers: makeClipPlane(),
    passionBody: makeClipPlane(),
    passionTowers: makeClipPlane(),
    naveWalls: makeClipPlane(),
    naveVaults: makeClipPlane(),
    evangelistTowers: makeClipPlane(),
    virginMaryTower: makeClipPlane(),
    jesusTower: makeClipPlane(),
    gloryFacade: makeClipPlane(),
  };

  const makeStone = (
    hex: number,
    roughness: number,
    clipPlane: THREE.Plane,
    profile: StoneReliefProfile = 'organic',
    flatShading = false,
    displacementScale = 0.042
  ) => {
    const texSet = profile === 'angular' ? angularStoneTex : organicStoneTex;
    const mat = new THREE.MeshStandardMaterial({
      color: hex,
      map: texSet.albedoMap,
      normalMap: texSet.normalMap,
      normalScale: new THREE.Vector2(
        profile === 'angular' ? 1.45 : 1.35,
        profile === 'angular' ? 1.45 : 1.35
      ),
      displacementMap: texSet.displacementMap,
      displacementScale,
      displacementBias: -displacementScale * 0.5,
      roughnessMap: texSet.roughnessMap,
      roughness,
      metalness: 0.03,
      flatShading,
      clippingPlanes: [clipPlane],
      clipShadows: true,
    });
    return applyWeatheredStoneShader(mat, profile);
  };

  const makeRecess = (clipPlane: THREE.Plane, hex = 0x2a211b, emissiveHex = 0xffaa44) =>
    new THREE.MeshStandardMaterial({
      color: hex,
      emissive: new THREE.Color(emissiveHex),
      emissiveIntensity: 0,
      roughness: 0.95,
      metalness: 0.02,
      clippingPlanes: [clipPlane],
    });

  const makeBronze = (clipPlane: THREE.Plane) =>
    new THREE.MeshStandardMaterial({
      color: 0x5c4734,
      roughness: 0.36,
      metalness: 0.72,
      clippingPlanes: [clipPlane],
      clipShadows: true,
    });

  // Phase 1: Rich Golden-Ochre Montjuic Sandstone & Venetian Trencadis
  const stoneCrypt = makeStone(0xaa8351, 0.9, clipPlanes.crypt);
  const stoneApse = makeStone(0xba8f58, 0.88, clipPlanes.apse);
  const stoneNativityBody = makeStone(0xc2955c, 0.86, clipPlanes.nativityBody);
  const stoneNativityTowers = makeStone(0xc99c62, 0.84, clipPlanes.nativityTowers);

  const finialNativityGold = new THREE.MeshStandardMaterial({
    color: 0xe69f30,
    emissive: new THREE.Color(0xffb443),
    emissiveIntensity: 0,
    roughness: 0.2,
    metalness: 0.42,
    clippingPlanes: [clipPlanes.nativityTowers],
    clipShadows: true,
  });
  const finialCypress = new THREE.MeshStandardMaterial({
    color: 0x2f6845,
    roughness: 0.36,
    metalness: 0.12,
    clippingPlanes: [clipPlanes.nativityBody],
    clipShadows: true,
  });
  const finialWhiteCeramic = new THREE.MeshStandardMaterial({
    color: 0xf8f3e9,
    emissive: new THREE.Color(0xffe1ae),
    emissiveIntensity: 0,
    roughness: 0.18,
    metalness: 0.1,
    clippingPlanes: [clipPlanes.nativityTowers],
    clipShadows: true,
  });
  const trencadisNativity = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: trencadisTex,
    emissive: new THREE.Color(0xffc966),
    emissiveIntensity: 0,
    roughness: 0.22,
    metalness: 0.15,
    clippingPlanes: [clipPlanes.nativityTowers],
    clipShadows: true,
  });
  const trencadisVirginMary = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: trencadisTex,
    emissive: new THREE.Color(0x93c5fd),
    emissiveIntensity: 0,
    roughness: 0.2,
    metalness: 0.18,
    clippingPlanes: [clipPlanes.virginMaryTower],
    clipShadows: true,
  });

  const bronzeNativity = makeBronze(clipPlanes.nativityBody);
  const bronzePassion = makeBronze(clipPlanes.passionBody);
  const bronzeGlory = makeBronze(clipPlanes.gloryFacade);

  // Phase 2: Stark Cool-Grey Passion Limestone (chiseled angular stone shader)
  const stonePassionBody = makeStone(0xb2aba0, 0.84, clipPlanes.passionBody, 'angular', true);
  const stonePassionTowers = makeStone(0xbbb4a9, 0.8, clipPlanes.passionTowers, 'angular', true);
  const finialPassion = new THREE.MeshStandardMaterial({
    color: 0xede7dc,
    emissive: new THREE.Color(0xdde7ff),
    emissiveIntensity: 0,
    roughness: 0.24,
    metalness: 0.26,
    flatShading: true,
    clippingPlanes: [clipPlanes.passionTowers],
    clipShadows: true,
  });

  // Phase 3: Nave Cream Sandstone, Terracotta Roof & Stained Glass
  const stoneNaveWalls = makeStone(0xd0b996, 0.86, clipPlanes.naveWalls);
  const stoneNaveVaults = makeStone(0xd7c3a2, 0.82, clipPlanes.naveVaults);
  const roofTerracotta = new THREE.MeshStandardMaterial({
    color: 0xa67448,
    roughness: 0.66,
    metalness: 0.06,
    normalMap: organicStoneTex.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    displacementMap: organicStoneTex.displacementMap,
    displacementScale: 0.022,
    displacementBias: -0.011,
    roughnessMap: organicStoneTex.roughnessMap,
    clippingPlanes: [clipPlanes.naveVaults],
    clipShadows: true,
  });
  const stainedGlass = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: stainedGlassTex,
    emissive: new THREE.Color(0xff9f2e),
    emissiveMap: stainedGlassTex,
    emissiveIntensity: 0.2,
    roughness: 0.2,
    metalness: 0.05,
    side: THREE.DoubleSide,
    clippingPlanes: [clipPlanes.naveWalls],
  });

  // Phase 4: Central Towers & Glory Facade
  const stoneEvangelists = makeStone(0xd1c1a8, 0.75, clipPlanes.evangelistTowers);
  const finialEvangelists = new THREE.MeshStandardMaterial({
    color: 0xf9f3e8,
    emissive: new THREE.Color(0xffebc2),
    emissiveIntensity: 0,
    roughness: 0.22,
    metalness: 0.25,
    clippingPlanes: [clipPlanes.evangelistTowers],
    clipShadows: true,
  });
  const stoneVirginMary = makeStone(0xd4c5ae, 0.74, clipPlanes.virginMaryTower);
  const starVirginMary = new THREE.MeshPhysicalMaterial({
    color: 0xffe8a3,
    emissive: new THREE.Color(0xffb830),
    emissiveIntensity: 2.1,
    roughness: 0.12,
    metalness: 0.25,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    clippingPlanes: [clipPlanes.virginMaryTower],
  });
  const stoneJesusTower = makeStone(0xd8cab3, 0.72, clipPlanes.jesusTower);
  const crossJesusTower = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0xffd982),
    emissiveIntensity: 0.65,
    roughness: 0.16,
    metalness: 0.3,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    clippingPlanes: [clipPlanes.jesusTower],
  });
  const stoneGloryFacade = makeStone(0xccb99b, 0.78, clipPlanes.gloryFacade);

  // Deep shadow recesses for acoustic louvers, lancet portals & oculi
  const shadowRecessCrypt = makeRecess(clipPlanes.crypt);
  const shadowRecessApse = makeRecess(clipPlanes.apse, 0x2e2319, 0xff9f38);
  const shadowRecessNativity = makeRecess(clipPlanes.nativityTowers, 0x2c221b, 0xffaa44);
  const shadowRecessPassion = makeRecess(clipPlanes.passionTowers, 0x242220, 0xc9dcff);
  const shadowRecessNave = makeRecess(clipPlanes.naveWalls, 0x2c221b, 0xff9f38);
  const shadowRecessEvan = makeRecess(clipPlanes.evangelistTowers, 0x2c221b, 0xffb85c);
  const shadowRecessMary = makeRecess(clipPlanes.virginMaryTower, 0x2c221b, 0xffd07a);
  const shadowRecessJesus = makeRecess(clipPlanes.jesusTower, 0x2c221b, 0xffcb70);
  const shadowRecessGlory = makeRecess(clipPlanes.gloryFacade, 0x2c221b, 0xffb04a);

  // Construction cranes & scaffolding
  const craneMast = new THREE.MeshStandardMaterial({
    color: 0x565e68,
    roughness: 0.45,
    metalness: 0.65,
  });
  const craneAccent = new THREE.MeshStandardMaterial({
    color: 0xd97724,
    roughness: 0.42,
    metalness: 0.35,
  });
  const scaffoldRing = new THREE.MeshStandardMaterial({
    color: 0x808994,
    roughness: 0.5,
    metalness: 0.6,
    transparent: true,
    opacity: 0.85,
  });

  // Barcelona Urban Context
  const plazaStone = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: plazaColorTex,
    roughness: 0.88,
    metalness: 0.02,
  });
  const plazaCurb = new THREE.MeshStandardMaterial({
    color: 0xb7aa96,
    roughness: 0.85,
    metalness: 0.03,
  });
  const poolWater = new THREE.MeshPhysicalMaterial({
    color: 0x26596e,
    roughness: 0.08,
    metalness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });
  const roadAsphalt = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: streetGridTex,
    roughness: 0.92,
    metalness: 0.02,
  });
  const eixampleBuilding = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: eixampleFacadeTex,
    emissive: new THREE.Color(0xffc978),
    emissiveMap: eixampleEmissiveTex,
    emissiveIntensity: 0,
    roughness: 0.86,
    metalness: 0.02,
  });
  const eixampleRoof = new THREE.MeshStandardMaterial({
    color: 0xa66f4d,
    roughness: 0.82,
    metalness: 0.02,
  });
  const eixampleTrim = new THREE.MeshStandardMaterial({
    color: 0x8d806e,
    roughness: 0.85,
    metalness: 0.04,
  });
  const hillsDistant = new THREE.MeshStandardMaterial({
    color: 0x8e9ba3,
    roughness: 0.94,
    metalness: 0.0,
    flatShading: false,
  });
  const treeTrunk = new THREE.MeshStandardMaterial({
    color: 0x5c4734,
    roughness: 0.9,
    metalness: 0.02,
  });
  const treeFoliage = new THREE.MeshStandardMaterial({
    color: 0x4f7340,
    roughness: 0.84,
    metalness: 0.02,
  });
  const cypressFoliage = new THREE.MeshStandardMaterial({
    color: 0x2b5436,
    roughness: 0.86,
    metalness: 0.02,
  });
  const lampIron = new THREE.MeshStandardMaterial({
    color: 0x292d34,
    roughness: 0.4,
    metalness: 0.72,
  });
  const lampGlow = new THREE.MeshStandardMaterial({
    color: 0xfff0cc,
    emissive: new THREE.Color(0xffbd59),
    emissiveIntensity: 0.15,
    roughness: 0.25,
    metalness: 0.05,
  });
  const birdFeather = new THREE.MeshStandardMaterial({
    color: 0x3b4048,
    roughness: 0.72,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const contactShadow = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });

  const allMaterials: THREE.Material[] = [
    stoneCrypt,
    stoneApse,
    stoneNativityBody,
    stoneNativityTowers,
    finialNativityGold,
    finialCypress,
    finialWhiteCeramic,
    trencadisNativity,
    trencadisVirginMary,
    bronzeNativity,
    bronzePassion,
    bronzeGlory,
    stonePassionBody,
    stonePassionTowers,
    finialPassion,
    stoneNaveWalls,
    stoneNaveVaults,
    roofTerracotta,
    stainedGlass,
    stoneEvangelists,
    finialEvangelists,
    stoneVirginMary,
    starVirginMary,
    stoneJesusTower,
    crossJesusTower,
    stoneGloryFacade,
    shadowRecessCrypt,
    shadowRecessApse,
    shadowRecessNativity,
    shadowRecessPassion,
    shadowRecessNave,
    shadowRecessEvan,
    shadowRecessMary,
    shadowRecessJesus,
    shadowRecessGlory,
    craneMast,
    craneAccent,
    scaffoldRing,
    plazaStone,
    plazaCurb,
    poolWater,
    roadAsphalt,
    eixampleBuilding,
    eixampleRoof,
    eixampleTrim,
    hillsDistant,
    treeTrunk,
    treeFoliage,
    cypressFoliage,
    lampIron,
    lampGlow,
    birdFeather,
    contactShadow,
  ];

  return {
    clipPlanes,
    stoneCrypt,
    stoneApse,
    stoneNativityBody,
    stoneNativityTowers,
    finialNativityGold,
    finialCypress,
    finialWhiteCeramic,
    trencadisNativity,
    trencadisVirginMary,
    bronzeNativity,
    bronzePassion,
    bronzeGlory,
    stonePassionBody,
    stonePassionTowers,
    finialPassion,
    stoneNaveWalls,
    stoneNaveVaults,
    roofTerracotta,
    stainedGlass,
    stoneEvangelists,
    finialEvangelists,
    stoneVirginMary,
    starVirginMary,
    stoneJesusTower,
    crossJesusTower,
    stoneGloryFacade,
    shadowRecessCrypt,
    shadowRecessApse,
    shadowRecessNativity,
    shadowRecessPassion,
    shadowRecessNave,
    shadowRecessEvan,
    shadowRecessMary,
    shadowRecessJesus,
    shadowRecessGlory,
    craneMast,
    craneAccent,
    scaffoldRing,
    plazaStone,
    plazaCurb,
    poolWater,
    roadAsphalt,
    eixampleBuilding,
    eixampleRoof,
    eixampleTrim,
    hillsDistant,
    treeTrunk,
    treeFoliage,
    cypressFoliage,
    lampIron,
    lampGlow,
    birdFeather,
    contactShadow,
    textures,
    dispose: () => {
      allMaterials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
