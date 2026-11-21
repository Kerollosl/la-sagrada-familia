import * as THREE from 'three';
import { BasilicaMaterials } from './materials';
import { PhaseProgressState } from '../data/timeline';
import { AtmosphereState } from '../utils/timeOfDay';
import { computeStackTransform, StackMode } from '../utils/stackingAnimation';
import {
  computeWeatherAtmosphere,
  createInitialFogWisps,
  createInitialRainDrops,
  stepFogWisps,
  stepRainDrops,
  WeatherMode,
} from '../utils/atmosphereParticles';
import {
  computeWingFlapAngle,
  createBirdFlock,
  stepBirdFlock,
} from '../utils/birdFlocking';
import { ARCHITECTURAL_FEATURES } from '../data/architecturalFeatures';

type StackPhaseKey =
  | 'crypt'
  | 'apse'
  | 'nativityBody'
  | 'nativityTowers'
  | 'passionBody'
  | 'passionTowers'
  | 'naveWalls'
  | 'naveVaults'
  | 'evangelistTowers'
  | 'virginMaryTower'
  | 'jesusTower'
  | 'gloryFacade';

interface StackPart {
  phase: StackPhaseKey;
  obj: THREE.Object3D;
  baseY: number;
  baseScaleX: number;
  baseScaleY: number;
  baseScaleZ: number;
  start: number;
  end: number;
  dropHeight: number;
  mode: StackMode;
  halfHeight: number;
}

export interface SagradaFamiliaSceneRig {
  root: THREE.Group;
  groups: {
    crypt: THREE.Group;
    apse: THREE.Group;
    nativityBody: THREE.Group;
    nativityTowers: THREE.Group;
    passionBody: THREE.Group;
    passionTowers: THREE.Group;
    naveWalls: THREE.Group;
    naveVaults: THREE.Group;
    evangelistTowers: THREE.Group;
    virginMaryTower: THREE.Group;
    jesusTower: THREE.Group;
    gloryFacade: THREE.Group;
  };
  cranes: {
    nativity: { group: THREE.Group; jib: THREE.Group; baseHeight: number };
    passion: { group: THREE.Group; jib: THREE.Group; baseHeight: number };
    central: { group: THREE.Group; jib: THREE.Group; baseHeight: number };
  };
  scaffolds: {
    nativity: THREE.Mesh;
    passion: THREE.Mesh;
    nave: THREE.Mesh;
    central: THREE.Mesh;
  };
  interiorLights: THREE.PointLight[];
  spireUplights: {
    nativity: THREE.PointLight;
    passion: THREE.PointLight;
    central: THREE.PointLight;
  };
  starLight: THREE.PointLight;
  starMesh: THREE.Group;
  hitboxMeshes: THREE.Mesh[];
  setFocusHighlight: (
    selectedId: string | null,
    hoveredId: string | null,
    focusMode: boolean,
    year: number
  ) => void;
  applyProgress: (
    progress: PhaseProgressState,
    elapsedSec: number,
    atmosphere: AtmosphereState
  ) => void;
  applyLivingScene: (
    dt: number,
    elapsedSec: number,
    atmosphere: AtmosphereState,
    weatherMode: WeatherMode,
    birdsEnabled: boolean
  ) => { rainOpacity: number; fogWispOpacity: number };
  dispose: () => void;
}

// Pre-allocated scratch helpers for zero-GC bird & particle updates
const _birdDummy = new THREE.Object3D();
const _wingLeftDummy = new THREE.Object3D();
const _wingRightDummy = new THREE.Object3D();
const _birdDir = new THREE.Vector3();
const _birdRight = new THREE.Vector3();
const _birdUp = new THREE.Vector3(0, 1, 0);

function addShadowProps(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function createSoftMistTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
  grad.addColorStop(0.45, 'rgba(240, 245, 255, 0.34)');
  grad.addColorStop(1, 'rgba(220, 232, 245, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCollserolaRidgeGeometry(): THREE.BufferGeometry {
  const radialSegs = 96;
  const ringSteps = 5;
  const innerR = 148;
  const outerR = 228;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r <= ringSteps; r++) {
    const rt = r / ringSteps; // 0 = inner base, 1 = outer skirt
    const rad = THREE.MathUtils.lerp(innerR, outerR, rt);
    const ridgeProfile = Math.sin(rt * Math.PI); // peaks near middle of ridge ring

    for (let i = 0; i <= radialSegs; i++) {
      const ang = (i / radialSegs) * Math.PI * 2;
      // Multi-octave harmonic mountain ridge (higher toward NW Tibidabo)
      const nwBias = Math.max(0, Math.cos(ang + Math.PI * 0.72)) * 0.65 + 0.45;
      const harmonic =
        Math.sin(ang * 3.0 + 0.4) * 0.45 +
        Math.cos(ang * 7.0 - 1.1) * 0.25 +
        Math.sin(ang * 13.0 + 2.2) * 0.14 +
        1.0;
      const height = Math.max(0, ridgeProfile * harmonic * nwBias * 14.5 - 0.6);

      positions.push(Math.cos(ang) * rad, height - 0.5, Math.sin(ang) * rad);
    }
  }

  const stride = radialSegs + 1;
  for (let r = 0; r < ringSteps; r++) {
    for (let i = 0; i < radialSegs; i++) {
      const a = r * stride + i;
      const b = (r + 1) * stride + i;
      const c = (r + 1) * stride + i + 1;
      const d = r * stride + i + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildHDTower(opts: {
  x: number;
  z: number;
  baseY: number;
  shaftHeight: number;
  baseRadius: number;
  topRadius: number;
  radialSegments: number;
  ribCount: number;
  louverBands: number;
  stoneMat: THREE.Material;
  recessMat: THREE.Material;
  finialMat: THREE.Material;
  accentMat: THREE.Material;
  trencadisMat?: THREE.Material;
  angularFinial?: boolean;
  geometries: THREE.BufferGeometry[];
  phase: StackPhaseKey;
  stagger?: number;
  registerPart: (
    phase: StackPhaseKey,
    obj: THREE.Object3D,
    start: number,
    end: number,
    dropHeight?: number,
    mode?: StackMode,
    halfHeight?: number
  ) => void;
}): THREE.Group {
  const group = new THREE.Group();
  group.position.set(opts.x, opts.baseY, opts.z);
  const st = opts.stagger ?? 0;

  // 1. Stepped octagonal plinth base + chamfered stone cornice
  const plinthGeo = new THREE.CylinderGeometry(
    opts.baseRadius * 1.12,
    opts.baseRadius * 1.28,
    2.6,
    Math.max(opts.radialSegments, 12),
    2
  );
  const plinthCapGeo = new THREE.TorusGeometry(opts.baseRadius * 1.14, 0.1, 6, opts.radialSegments);
  opts.geometries.push(plinthGeo, plinthCapGeo);

  const plinth = new THREE.Mesh(plinthGeo, opts.stoneMat);
  plinth.position.y = 1.3;
  group.add(plinth);
  opts.registerPart(opts.phase, plinth, st * 0.5, st * 0.5 + 0.14, 4.0, 'drop');

  const plinthCap = new THREE.Mesh(plinthCapGeo, opts.stoneMat);
  plinthCap.rotation.x = Math.PI / 2;
  plinthCap.position.y = 2.55;
  group.add(plinthCap);
  opts.registerPart(opts.phase, plinthCap, st * 0.5 + 0.04, st * 0.5 + 0.16, 4.2, 'drop');

  // 2. Stacked parabolic masonry drum courses (8 interlocking subdivided rings for displacement relief)
  const drumTiers = 8;
  for (let k = 0; k < drumTiers; k++) {
    const t0 = k / drumTiers;
    const t1 = (k + 1) / drumTiers;
    const r0 = THREE.MathUtils.lerp(opts.baseRadius * 0.94, opts.topRadius * 0.92, Math.pow(t0, 0.72));
    const r1 = THREE.MathUtils.lerp(opts.baseRadius * 0.94, opts.topRadius * 0.92, Math.pow(t1, 0.72));
    const segH = opts.shaftHeight / drumTiers;
    const drumGeo = new THREE.CylinderGeometry(
      r1,
      r0,
      segH * 1.02,
      Math.max(opts.radialSegments, 16),
      4
    );
    opts.geometries.push(drumGeo);
    const drum = new THREE.Mesh(drumGeo, opts.stoneMat);
    drum.position.y = 2.4 + (t0 + t1) * 0.5 * opts.shaftHeight;
    group.add(drum);

    const dStart = Math.min(0.7, st + (k / drumTiers) * 0.56 + 0.04);
    const dEnd = Math.min(0.84, dStart + 0.15);
    opts.registerPart(opts.phase, drum, dStart, dEnd, 5.2, 'drop');
  }

  // 3. Sculpted vertical stone buttress ribs + subtle helical flare
  const ribGeo = new THREE.BoxGeometry(0.15, opts.shaftHeight * 0.95, 0.28);
  opts.geometries.push(ribGeo);
  const leanAngle = Math.atan2(opts.baseRadius - opts.topRadius, opts.shaftHeight);

  for (let i = 0; i < opts.ribCount; i++) {
    const angle = (i / opts.ribCount) * Math.PI * 2;
    const midR = (opts.baseRadius + opts.topRadius) * 0.525;
    const rib = new THREE.Mesh(ribGeo, opts.stoneMat);
    rib.position.set(
      Math.cos(angle) * midR,
      2.4 + opts.shaftHeight * 0.475,
      Math.sin(angle) * midR
    );
    rib.rotation.y = -angle;
    rib.rotation.z = leanAngle;
    group.add(rib);
    opts.registerPart(
      opts.phase,
      rib,
      st + 0.1,
      Math.min(0.86, st + 0.74),
      0,
      'growY',
      opts.shaftHeight * 0.475
    );
  }

  // 4. Perforated horizontal acoustic louver bands + carved stone cornice rings
  for (let b = 0; b < opts.louverBands; b++) {
    const frac = 0.14 + (b / opts.louverBands) * 0.8;
    const r = THREE.MathUtils.lerp(opts.baseRadius, opts.topRadius, Math.pow(frac, 0.72));
    const yPos = 2.4 + frac * opts.shaftHeight;
    const tierFrac = b / Math.max(1, opts.louverBands - 1);
    const bStart = Math.min(0.74, st + 0.08 + tierFrac * 0.56);
    const bEnd = Math.min(0.86, bStart + 0.14);

    const slotGeo = new THREE.CylinderGeometry(r * 0.99, r * 1.01, 0.34, opts.radialSegments);
    opts.geometries.push(slotGeo);
    const slot = new THREE.Mesh(slotGeo, opts.recessMat);
    slot.position.y = yPos;
    group.add(slot);
    opts.registerPart(opts.phase, slot, bStart, bEnd, 3.2, 'pop');

    if (b % 2 === 0) {
      const collarGeo = new THREE.TorusGeometry(r * 1.055, 0.09, 6, opts.radialSegments);
      opts.geometries.push(collarGeo);
      const collar = new THREE.Mesh(collarGeo, opts.stoneMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = yPos + 0.24;
      group.add(collar);
      opts.registerPart(opts.phase, collar, bStart, bEnd, 4.0, 'drop');
    }
  }

  // 5. Pinnacle Crown: stepped gallery gables, trencadís mosaic neck, orb/pyramid & starburst
  const crownY = 2.4 + opts.shaftHeight;
  const neckGeo = new THREE.CylinderGeometry(
    opts.topRadius * 0.9,
    opts.topRadius * 1.15,
    1.25,
    opts.radialSegments
  );
  const collarRingGeo = new THREE.TorusGeometry(opts.topRadius * 1.18, 0.1, 6, opts.radialSegments);
  const gableDotGeo = new THREE.ConeGeometry(opts.topRadius * 0.3, 0.72, 4);
  opts.geometries.push(neckGeo, collarRingGeo, gableDotGeo);

  const neckMat = opts.trencadisMat ?? opts.accentMat;
  const neck = new THREE.Mesh(neckGeo, neckMat);
  neck.position.y = crownY + 0.55;
  group.add(neck);
  opts.registerPart(opts.phase, neck, Math.min(0.76, st + 0.66), Math.min(0.9, st + 0.8), 5.0, 'drop');

  const neckRing = new THREE.Mesh(collarRingGeo, opts.stoneMat);
  neckRing.rotation.x = Math.PI / 2;
  neckRing.position.y = crownY + 0.05;
  group.add(neckRing);
  opts.registerPart(opts.phase, neckRing, Math.min(0.76, st + 0.65), Math.min(0.89, st + 0.79), 4.6, 'drop');

  for (let g = 0; g < 4; g++) {
    const ga = (g / 4) * Math.PI * 2 + Math.PI / 4;
    const gDot = new THREE.Mesh(gableDotGeo, opts.stoneMat);
    gDot.position.set(
      Math.cos(ga) * opts.topRadius * 1.12,
      crownY + 0.35,
      Math.sin(ga) * opts.topRadius * 1.12
    );
    gDot.rotation.y = -ga;
    group.add(gDot);
    opts.registerPart(opts.phase, gDot, Math.min(0.78, st + 0.68), Math.min(0.92, st + 0.82), 4.2, 'drop');
  }

  if (opts.angularFinial) {
    const pyrGeo = new THREE.OctahedronGeometry(opts.topRadius * 1.28, 0);
    opts.geometries.push(pyrGeo);
    const pyr = new THREE.Mesh(pyrGeo, opts.finialMat);
    pyr.scale.set(0.95, 1.58, 0.95);
    pyr.position.y = crownY + 1.98;
    group.add(pyr);
    opts.registerPart(opts.phase, pyr, Math.min(0.82, st + 0.74), Math.min(0.95, st + 0.88), 5.5, 'drop');

    const spireGeo = new THREE.ConeGeometry(opts.topRadius * 0.48, 1.65, 4);
    opts.geometries.push(spireGeo);
    const spire = new THREE.Mesh(spireGeo, opts.accentMat);
    spire.position.y = crownY + 3.25;
    group.add(spire);
    opts.registerPart(opts.phase, spire, Math.min(0.88, st + 0.82), 1.0, 5.5, 'drop');
  } else {
    const orbGeo = new THREE.IcosahedronGeometry(opts.topRadius * 1.18, 1);
    const spikeGeo = new THREE.ConeGeometry(opts.topRadius * 0.22, opts.topRadius * 1.65, 4);
    const tipGeo = new THREE.ConeGeometry(opts.topRadius * 0.44, 1.7, 8);
    opts.geometries.push(orbGeo, spikeGeo, tipGeo);

    const orb = new THREE.Mesh(orbGeo, opts.trencadisMat ?? opts.finialMat);
    orb.position.y = crownY + 1.72;
    group.add(orb);
    opts.registerPart(opts.phase, orb, Math.min(0.82, st + 0.74), Math.min(0.95, st + 0.88), 5.5, 'drop');

    for (let s = 0; s < 8; s++) {
      const ang = (s / 8) * Math.PI * 2;
      const sp = new THREE.Mesh(spikeGeo, s % 2 === 0 ? opts.accentMat : opts.finialMat);
      sp.position.set(
        Math.cos(ang) * opts.topRadius * 1.06,
        crownY + 1.72,
        Math.sin(ang) * opts.topRadius * 1.06
      );
      sp.rotation.z = -Math.cos(ang) * (Math.PI / 2);
      sp.rotation.x = Math.sin(ang) * (Math.PI / 2);
      group.add(sp);
      opts.registerPart(opts.phase, sp, Math.min(0.86, st + 0.8), 0.98, 2.5, 'pop');
    }

    const tip = new THREE.Mesh(tipGeo, opts.accentMat);
    tip.position.y = crownY + 3.1;
    group.add(tip);
    opts.registerPart(opts.phase, tip, Math.min(0.88, st + 0.84), 1.0, 5.5, 'drop');
  }

  addShadowProps(group);
  return group;
}

function createTwelvePointedStar(
  material: THREE.Material,
  geometries: THREE.BufferGeometry[]
): THREE.Group {
  const starGroup = new THREE.Group();
  const coreGeo = new THREE.IcosahedronGeometry(0.48, 0);
  const rayGeo = new THREE.ConeGeometry(0.27, 1.62, 4);
  geometries.push(coreGeo, rayGeo);

  const core = new THREE.Mesh(coreGeo, material);
  starGroup.add(core);

  const phi = (1 + Math.sqrt(5)) / 2;
  const rawDirs = [
    [-1, phi, 0],
    [1, phi, 0],
    [-1, -phi, 0],
    [1, -phi, 0],
    [0, -1, phi],
    [0, 1, phi],
    [0, -1, -phi],
    [0, 1, -phi],
    [phi, 0, -1],
    [phi, 0, 1],
    [-phi, 0, -1],
    [-phi, 0, 1],
  ];
  const up = new THREE.Vector3(0, 1, 0);
  const dirVec = new THREE.Vector3();

  for (const [dx, dy, dz] of rawDirs) {
    dirVec.set(dx, dy, dz).normalize();
    const ray = new THREE.Mesh(rayGeo, material);
    ray.position.copy(dirVec).multiplyScalar(0.78);
    ray.quaternion.setFromUnitVectors(up, dirVec);
    starGroup.add(ray);
  }
  return starGroup;
}

function createFourArmedCross(
  material: THREE.Material,
  accentMaterial: THREE.Material,
  geometries: THREE.BufferGeometry[]
): THREE.Group {
  const cross = new THREE.Group();

  const armVerticalGeo = new THREE.BoxGeometry(0.68, 4.5, 0.68);
  const armXGeo = new THREE.BoxGeometry(3.35, 0.64, 0.64);
  const armZGeo = new THREE.BoxGeometry(0.64, 0.64, 3.35);
  const capGeo = new THREE.OctahedronGeometry(0.58, 0);
  const hubGeo = new THREE.IcosahedronGeometry(0.8, 1);
  const braceGeo = new THREE.BoxGeometry(0.32, 0.9, 0.32);

  geometries.push(armVerticalGeo, armXGeo, armZGeo, capGeo, hubGeo, braceGeo);

  const vert = new THREE.Mesh(armVerticalGeo, material);
  vert.position.y = 1.68;
  cross.add(vert);

  const armX = new THREE.Mesh(armXGeo, material);
  armX.position.y = 2.18;
  cross.add(armX);

  const armZ = new THREE.Mesh(armZGeo, material);
  armZ.position.y = 2.18;
  cross.add(armZ);

  const hub = new THREE.Mesh(hubGeo, accentMaterial);
  hub.position.y = 2.18;
  cross.add(hub);

  const capOffsets: [number, number, number][] = [
    [0, 4.02, 0],
    [1.76, 2.18, 0],
    [-1.76, 2.18, 0],
    [0, 2.18, 1.76],
    [0, 2.18, -1.76],
  ];
  for (const [cx, cy, cz] of capOffsets) {
    const cap = new THREE.Mesh(capGeo, accentMaterial);
    cap.position.set(cx, cy, cz);
    cross.add(cap);
  }

  return cross;
}

function createTowerCrane(
  mastHeight: number,
  jibLength: number,
  mastMat: THREE.Material,
  accentMat: THREE.Material,
  geometries: THREE.BufferGeometry[]
): { group: THREE.Group; jib: THREE.Group } {
  const group = new THREE.Group();

  const baseGeo = new THREE.BoxGeometry(1.3, 0.65, 1.3);
  const mastGeo = new THREE.BoxGeometry(0.42, mastHeight, 0.42);
  geometries.push(baseGeo, mastGeo);

  const base = new THREE.Mesh(baseGeo, mastMat);
  base.position.y = 0.32;
  group.add(base);

  const mast = new THREE.Mesh(mastGeo, accentMat);
  mast.position.y = mastHeight / 2;
  group.add(mast);

  const jib = new THREE.Group();
  jib.position.y = mastHeight;

  const cabGeo = new THREE.BoxGeometry(0.75, 0.78, 0.95);
  const boomGeo = new THREE.BoxGeometry(0.28, 0.34, jibLength);
  const counterGeo = new THREE.BoxGeometry(0.72, 0.6, 1.55);
  const topPeakGeo = new THREE.ConeGeometry(0.36, 1.85, 4);
  const cableGeo = new THREE.CylinderGeometry(0.025, 0.025, 5.0, 6);
  const hookGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);

  geometries.push(cabGeo, boomGeo, counterGeo, topPeakGeo, cableGeo, hookGeo);

  const cab = new THREE.Mesh(cabGeo, mastMat);
  cab.position.set(0, 0.4, 0.25);
  jib.add(cab);

  const boom = new THREE.Mesh(boomGeo, accentMat);
  boom.position.set(0, 0.78, jibLength * 0.34);
  jib.add(boom);

  const counter = new THREE.Mesh(counterGeo, mastMat);
  counter.position.set(0, 0.68, -jibLength * 0.2);
  jib.add(counter);

  const peak = new THREE.Mesh(topPeakGeo, accentMat);
  peak.position.set(0, 1.75, 0);
  jib.add(peak);

  const cable = new THREE.Mesh(cableGeo, mastMat);
  cable.position.set(0, -1.7, jibLength * 0.64);
  jib.add(cable);

  const hook = new THREE.Mesh(hookGeo, accentMat);
  hook.position.set(0, -4.2, jibLength * 0.64);
  jib.add(hook);

  group.add(jib);
  addShadowProps(group);
  return { group, jib };
}

export function buildSagradaFamiliaScene(
  scene: THREE.Scene,
  mats: BasilicaMaterials
): SagradaFamiliaSceneRig {
  const geometries: THREE.BufferGeometry[] = [];
  const disposableMaterials: THREE.Material[] = [];
  const disposableTextures: THREE.Texture[] = [];

  const stackParts: StackPart[] = [];
  const registerPart = (
    phase: StackPhaseKey,
    obj: THREE.Object3D,
    start: number,
    end: number,
    dropHeight = 5.0,
    mode: StackMode = 'drop',
    halfHeight = 0
  ) => {
    stackParts.push({
      phase,
      obj,
      baseY: obj.position.y,
      baseScaleX: obj.scale.x,
      baseScaleY: obj.scale.y,
      baseScaleZ: obj.scale.z,
      start,
      end,
      dropHeight,
      mode,
      halfHeight,
    });
  };

  const root = new THREE.Group();
  scene.add(root);

  // ------------------------------------------------------------------
  // 0. Barcelona Eixample Plaza, Plaça de Gaudí Reflecting Pool,
  //    Streetlamps, Chamfered Manzana Blocks & Collserola Ridge
  // ------------------------------------------------------------------
  const envGroup = new THREE.Group();

  const plazaSize = 24.5;
  const chamfer = 4.9;
  const plazaShape = new THREE.Shape();
  plazaShape.moveTo(-plazaSize + chamfer, -plazaSize);
  plazaShape.lineTo(plazaSize - chamfer, -plazaSize);
  plazaShape.lineTo(plazaSize, -plazaSize + chamfer);
  plazaShape.lineTo(plazaSize, plazaSize - chamfer);
  plazaShape.lineTo(plazaSize - chamfer, plazaSize);
  plazaShape.lineTo(-plazaSize + chamfer, plazaSize);
  plazaShape.lineTo(-plazaSize, plazaSize - chamfer);
  plazaShape.lineTo(-plazaSize, -plazaSize + chamfer);
  plazaShape.closePath();

  const plazaGeo = new THREE.ExtrudeGeometry(plazaShape, {
    depth: 0.45,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  plazaGeo.rotateX(-Math.PI / 2);
  geometries.push(plazaGeo);
  const plazaMesh = new THREE.Mesh(plazaGeo, mats.plazaStone);
  plazaMesh.position.y = -0.45;
  plazaMesh.receiveShadow = true;
  envGroup.add(plazaMesh);

  // Raised basilica plinth terrace apron + Plaça de Gaudí reflecting pool (+X East)
  const apronGeo = new THREE.BoxGeometry(20.6, 0.16, 26.2);
  const poolRimGeo = new THREE.BoxGeometry(7.6, 0.24, 15.6);
  const poolWaterGeo = new THREE.PlaneGeometry(6.7, 14.7);
  poolWaterGeo.rotateX(-Math.PI / 2);
  const gaudiAveGeo = new THREE.BoxGeometry(6.6, 0.06, 48);
  geometries.push(apronGeo, poolRimGeo, poolWaterGeo, gaudiAveGeo);

  const apron = new THREE.Mesh(apronGeo, mats.plazaCurb);
  apron.position.set(0, 0.04, 0.2);
  apron.receiveShadow = true;
  envGroup.add(apron);

  const poolRim = new THREE.Mesh(poolRimGeo, mats.plazaCurb);
  poolRim.position.set(18.2, 0.06, 0);
  poolRim.receiveShadow = true;
  envGroup.add(poolRim);

  const poolWater = new THREE.Mesh(poolWaterGeo, mats.poolWater);
  poolWater.position.set(18.2, 0.2, 0);
  poolWater.receiveShadow = true;
  envGroup.add(poolWater);

  // Diagonal Avinguda Gaudí promenade stretching from Nativity/Apse corner toward Sant Pau
  const gaudiAve = new THREE.Mesh(gaudiAveGeo, mats.plazaStone);
  gaudiAve.position.set(22, -0.42, -22);
  gaudiAve.rotation.y = -Math.PI / 4;
  gaudiAve.receiveShadow = true;
  envGroup.add(gaudiAve);

  // Surrounding urban Barcelona asphalt street grid
  const streetGeo = new THREE.PlaneGeometry(460, 460);
  streetGeo.rotateX(-Math.PI / 2);
  geometries.push(streetGeo);
  const streetMesh = new THREE.Mesh(streetGeo, mats.roadAsphalt);
  streetMesh.position.y = -0.52;
  streetMesh.receiveShadow = true;
  envGroup.add(streetMesh);

  const contactGeo = new THREE.PlaneGeometry(36, 42);
  contactGeo.rotateX(-Math.PI / 2);
  geometries.push(contactGeo);
  const contactDisc = new THREE.Mesh(contactGeo, mats.contactShadow);
  contactDisc.position.set(0, 0.13, 0);
  envGroup.add(contactDisc);

  // Chamfered Eixample Manzana City Blocks (sidewalks, facades, rooftop cornices & courtyards)
  const eixShape = new THREE.Shape();
  const bs = 10.5;
  const bc = 2.2;
  eixShape.moveTo(-bs + bc, -bs);
  eixShape.lineTo(bs - bc, -bs);
  eixShape.lineTo(bs, -bs + bc);
  eixShape.lineTo(bs, bs - bc);
  eixShape.lineTo(bs - bc, bs);
  eixShape.lineTo(-bs + bc, bs);
  eixShape.lineTo(-bs, bs - bc);
  eixShape.lineTo(-bs, -bs + bc);
  eixShape.closePath();

  const bldgSidewalkGeo = new THREE.ExtrudeGeometry(eixShape, { depth: 0.24, bevelEnabled: false });
  bldgSidewalkGeo.rotateX(-Math.PI / 2);
  const bldgBodyGeo = new THREE.ExtrudeGeometry(eixShape, { depth: 1, bevelEnabled: false });
  bldgBodyGeo.rotateX(-Math.PI / 2);
  const bldgRoofGeo = new THREE.ExtrudeGeometry(eixShape, { depth: 0.28, bevelEnabled: false });
  bldgRoofGeo.rotateX(-Math.PI / 2);
  const bldgCourtyardGeo = new THREE.BoxGeometry(6.8, 0.35, 6.8);
  const penthouseGeo = new THREE.BoxGeometry(6.4, 1.05, 6.4);
  geometries.push(bldgSidewalkGeo, bldgBodyGeo, bldgRoofGeo, bldgCourtyardGeo, penthouseGeo);

  const blockCoords: [number, number, number][] = [];
  for (let gx = -3; gx <= 3; gx++) {
    for (let gz = -3; gz <= 3; gz++) {
      if (gx === 0 && gz === 0) continue;
      if (gx === 0 && gz === 1) continue; // Keep south Glory avenue open
      if (gx === 1 && gz === -1) continue; // Keep diagonal Avinguda Gaudí clear
      const px = gx * 33;
      const pz = gz * 33;
      if (Math.hypot(px, pz) < 35) continue;
      const h = 4.6 + ((Math.abs(gx * 11 + gz * 17) % 6) * 0.7);
      blockCoords.push([px, h, pz]);
    }
  }

  const sidewalkInst = new THREE.InstancedMesh(bldgSidewalkGeo, mats.plazaCurb, blockCoords.length);
  const bldgInst = new THREE.InstancedMesh(bldgBodyGeo, mats.eixampleBuilding, blockCoords.length);
  const roofInst = new THREE.InstancedMesh(bldgRoofGeo, mats.eixampleRoof, blockCoords.length);
  const courtInst = new THREE.InstancedMesh(bldgCourtyardGeo, mats.eixampleTrim, blockCoords.length);
  const pentInst = new THREE.InstancedMesh(penthouseGeo, mats.eixampleBuilding, blockCoords.length);
  const dummy = new THREE.Object3D();
  const blockTint = new THREE.Color();

  blockCoords.forEach(([bx, bh, bz], idx) => {
    dummy.position.set(bx, -0.51, bz);
    dummy.scale.set(1.26, 1.0, 1.26);
    dummy.rotation.y = 0;
    dummy.updateMatrix();
    sidewalkInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(bx, -0.32, bz);
    dummy.scale.set(1.14, bh, 1.14);
    dummy.updateMatrix();
    bldgInst.setMatrixAt(idx, dummy.matrix);

    blockTint.setHSL(0.08 + ((idx % 4) - 1.5) * 0.015, 0.14, 0.87 - (idx % 3) * 0.05);
    bldgInst.setColorAt(idx, blockTint);

    dummy.position.set(bx, -0.32 + bh, bz);
    dummy.scale.set(1.11, 1.0, 1.11);
    dummy.updateMatrix();
    roofInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(bx, -0.32 + bh + 0.16, bz);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    courtInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(bx + ((idx % 3) - 1) * 3.8, -0.32 + bh + 0.52, bz + (((idx + 1) % 3) - 1) * 2.8);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    pentInst.setMatrixAt(idx, dummy.matrix);
  });

  sidewalkInst.instanceMatrix.needsUpdate = true;
  bldgInst.instanceMatrix.needsUpdate = true;
  if (bldgInst.instanceColor) bldgInst.instanceColor.needsUpdate = true;
  roofInst.instanceMatrix.needsUpdate = true;
  courtInst.instanceMatrix.needsUpdate = true;
  pentInst.instanceMatrix.needsUpdate = true;
  sidewalkInst.receiveShadow = true;
  bldgInst.receiveShadow = true;
  bldgInst.castShadow = true;
  roofInst.receiveShadow = true;
  sidewalkInst.computeBoundingSphere();
  bldgInst.computeBoundingSphere();
  roofInst.computeBoundingSphere();
  courtInst.computeBoundingSphere();
  pentInst.computeBoundingSphere();
  envGroup.add(sidewalkInst, bldgInst, roofInst, courtInst, pentInst);

  // Continuous sculpted Collserola Mountain Ridge + Distant Tibidabo Crest
  const ridgeGeo = createCollserolaRidgeGeometry();
  const tibidaboGeo = new THREE.ConeGeometry(2.2, 6.2, 6);
  geometries.push(ridgeGeo, tibidaboGeo);
  const ridgeMesh = new THREE.Mesh(ridgeGeo, mats.hillsDistant);
  envGroup.add(ridgeMesh);
  const tibidaboCrest = new THREE.Mesh(tibidaboGeo, mats.hillsDistant);
  tibidaboCrest.position.set(-142, 13.5, -118);
  envGroup.add(tibidaboCrest);

  // Multi-part Mediterranean Plane Trees + Tall Italian Cypresses around plaza
  const planeTreeCoords: [number, number][] = [];
  for (let i = -21; i <= 21; i += 4.2) {
    if (Math.abs(i) > 7.5) {
      planeTreeCoords.push([i, -22.8], [i, 22.8], [-22.8, i], [22.8, i]);
    }
  }
  const cypressCoords: [number, number][] = [
    [13.8, -8.2],
    [13.8, 8.2],
    [21.6, -8.2],
    [21.6, 8.2],
    [-14.5, -14.5],
    [-14.5, 14.5],
    [14.5, 14.5],
  ];

  const trunkGeo = new THREE.CylinderGeometry(0.11, 0.17, 1.65, 6);
  const crownGeo = new THREE.DodecahedronGeometry(0.84, 1);
  const crownTopGeo = new THREE.DodecahedronGeometry(0.58, 1);
  const cypTrunkGeo = new THREE.CylinderGeometry(0.08, 0.13, 1.1, 6);
  const cypCrownGeo = new THREE.ConeGeometry(0.54, 4.2, 8);
  geometries.push(trunkGeo, crownGeo, crownTopGeo, cypTrunkGeo, cypCrownGeo);

  const trunksInst = new THREE.InstancedMesh(trunkGeo, mats.treeTrunk, planeTreeCoords.length);
  const crownsInst = new THREE.InstancedMesh(crownGeo, mats.treeFoliage, planeTreeCoords.length);
  const crownTopsInst = new THREE.InstancedMesh(crownTopGeo, mats.treeFoliage, planeTreeCoords.length);
  const treeColor = new THREE.Color();

  planeTreeCoords.forEach(([tx, tz], i) => {
    const s = 0.85 + ((i * 37) % 30) / 100;
    dummy.position.set(tx, 0.82 * s, tz);
    dummy.scale.set(s, s, s);
    dummy.rotation.y = i * 0.8;
    dummy.updateMatrix();
    trunksInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(tx, 1.95 * s, tz);
    dummy.scale.set(s * 1.15, s * 1.15, s * 1.15);
    dummy.updateMatrix();
    crownsInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(tx + 0.2 * s, 2.55 * s, tz - 0.15 * s);
    dummy.scale.set(s * 0.95, s * 0.9, s * 0.95);
    dummy.updateMatrix();
    crownTopsInst.setMatrixAt(i, dummy.matrix);

    treeColor.setHSL(0.27 + ((i % 5) - 2) * 0.014, 0.36, 0.35 + (i % 3) * 0.03);
    crownsInst.setColorAt(i, treeColor);
    crownTopsInst.setColorAt(i, treeColor);
  });
  trunksInst.instanceMatrix.needsUpdate = true;
  crownsInst.instanceMatrix.needsUpdate = true;
  crownTopsInst.instanceMatrix.needsUpdate = true;
  if (crownsInst.instanceColor) crownsInst.instanceColor.needsUpdate = true;
  if (crownTopsInst.instanceColor) crownTopsInst.instanceColor.needsUpdate = true;
  trunksInst.castShadow = true;
  crownsInst.castShadow = true;
  crownTopsInst.castShadow = true;
  trunksInst.computeBoundingSphere();
  crownsInst.computeBoundingSphere();
  crownTopsInst.computeBoundingSphere();
  envGroup.add(trunksInst, crownsInst, crownTopsInst);

  const cypTrunksInst = new THREE.InstancedMesh(cypTrunkGeo, mats.treeTrunk, cypressCoords.length);
  const cypCrownsInst = new THREE.InstancedMesh(cypCrownGeo, mats.cypressFoliage, cypressCoords.length);
  cypressCoords.forEach(([cx, cz], i) => {
    const s = 0.95 + (i % 3) * 0.12;
    dummy.position.set(cx, 0.55 * s, cz);
    dummy.scale.set(s, s, s);
    dummy.rotation.y = i * 0.5;
    dummy.updateMatrix();
    cypTrunksInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(cx, 2.6 * s, cz);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    cypCrownsInst.setMatrixAt(i, dummy.matrix);
  });
  cypTrunksInst.instanceMatrix.needsUpdate = true;
  cypCrownsInst.instanceMatrix.needsUpdate = true;
  cypCrownsInst.castShadow = true;
  cypTrunksInst.computeBoundingSphere();
  cypCrownsInst.computeBoundingSphere();
  envGroup.add(cypTrunksInst, cypCrownsInst);

  // Ornate Wrought-Iron Barcelona Streetlamps along Plaza & Avinguda Gaudí
  const lampCoords: [number, number][] = [];
  for (let i = -18; i <= 18; i += 9) {
    lampCoords.push([i, -20.6], [i, 20.6], [-20.6, i], [20.6, i]);
  }
  const lampPostGeo = new THREE.CylinderGeometry(0.05, 0.09, 2.55, 6);
  const lampGlobeGeo = new THREE.SphereGeometry(0.22, 8, 6);
  geometries.push(lampPostGeo, lampGlobeGeo);

  const lampPostsInst = new THREE.InstancedMesh(lampPostGeo, mats.lampIron, lampCoords.length);
  const lampGlobesInst = new THREE.InstancedMesh(lampGlobeGeo, mats.lampGlow, lampCoords.length);
  lampCoords.forEach(([lx, lz], i) => {
    dummy.position.set(lx, 1.28, lz);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    lampPostsInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(lx, 2.66, lz);
    dummy.updateMatrix();
    lampGlobesInst.setMatrixAt(i, dummy.matrix);
  });
  lampPostsInst.instanceMatrix.needsUpdate = true;
  lampGlobesInst.instanceMatrix.needsUpdate = true;
  lampPostsInst.computeBoundingSphere();
  lampGlobesInst.computeBoundingSphere();
  envGroup.add(lampPostsInst, lampGlobesInst);

  root.add(envGroup);

  // ------------------------------------------------------------------
  // PHASE 1 (1882–1926): Crypt, Apse & Nativity Facade
  // ------------------------------------------------------------------
  const cryptGroup = new THREE.Group();
  const baseCrossShape = new THREE.Shape();
  baseCrossShape.moveTo(-4.8, -10.5);
  baseCrossShape.lineTo(4.8, -10.5);
  baseCrossShape.lineTo(4.8, -4.2);
  baseCrossShape.lineTo(8.8, -4.2);
  baseCrossShape.lineTo(8.8, 4.2);
  baseCrossShape.lineTo(4.8, 4.2);
  baseCrossShape.lineTo(4.8, 11.4);
  baseCrossShape.lineTo(-4.8, 11.4);
  baseCrossShape.lineTo(-4.8, 4.2);
  baseCrossShape.lineTo(-8.8, 4.2);
  baseCrossShape.lineTo(-8.8, -4.2);
  baseCrossShape.lineTo(-4.8, -4.2);
  baseCrossShape.closePath();

  const plinthGeo = new THREE.ExtrudeGeometry(baseCrossShape, {
    depth: 1.05,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.16,
    bevelSegments: 2,
  });
  plinthGeo.rotateX(Math.PI / 2);
  const cryptRingGeo = new THREE.CylinderGeometry(5.65, 6.0, 1.5, 14);
  const cryptStepGeo = new THREE.BoxGeometry(10.6, 0.35, 22.8);
  geometries.push(plinthGeo, cryptRingGeo, cryptStepGeo);

  const plinthMesh = new THREE.Mesh(plinthGeo, mats.stoneCrypt);
  plinthMesh.position.y = 1.05;
  cryptGroup.add(plinthMesh);
  registerPart('crypt', plinthMesh, 0.0, 0.62, 3.2, 'drop');

  const cryptStep = new THREE.Mesh(cryptStepGeo, mats.stoneCrypt);
  cryptStep.position.set(0, 0.18, 0.4);
  cryptGroup.add(cryptStep);
  registerPart('crypt', cryptStep, 0.0, 0.4, 2.5, 'drop');

  const cryptRing = new THREE.Mesh(cryptRingGeo, mats.stoneCrypt);
  cryptRing.position.set(0, 0.75, -7.8);
  cryptGroup.add(cryptRing);
  registerPart('crypt', cryptRing, 0.35, 1.0, 4.0, 'drop');
  addShadowProps(cryptGroup);
  root.add(cryptGroup);

  // Apse Chapels, Stained-Glass Lancets, Flying Ribs & 7 Fluted Pinnacles (-Z)
  const apseGroup = new THREE.Group();
  const apseCoreGeo = new THREE.CylinderGeometry(5.1, 5.3, 8.2, 24, 8, false, Math.PI * 0.5, Math.PI);
  const apseRoofGeo = new THREE.ConeGeometry(5.2, 3.2, 24, 4, false, Math.PI * 0.5, Math.PI);
  const chapelGeo = new THREE.CylinderGeometry(0.95, 1.08, 6.4, 12, 6);
  const chapelSlitGeo = new THREE.BoxGeometry(0.32, 3.6, 0.18);
  const chapelRoofGeo = new THREE.ConeGeometry(1.08, 2.4, 12, 3);
  const flyingRibGeo = new THREE.BoxGeometry(0.24, 0.35, 1.85);
  const pinnacleShaftGeo = new THREE.CylinderGeometry(0.18, 0.36, 7.2, 10, 4);
  const pinnacleTipGeo = new THREE.ConeGeometry(0.26, 2.1, 10, 2);
  const pinnacleCapGeo = new THREE.IcosahedronGeometry(0.24, 1);
  geometries.push(
    apseCoreGeo,
    apseRoofGeo,
    chapelGeo,
    chapelSlitGeo,
    chapelRoofGeo,
    flyingRibGeo,
    pinnacleShaftGeo,
    pinnacleTipGeo,
    pinnacleCapGeo
  );

  const apseCore = new THREE.Mesh(apseCoreGeo, mats.stoneApse);
  apseCore.position.set(0, 5.1, -7.5);
  apseGroup.add(apseCore);
  registerPart('apse', apseCore, 0.0, 0.42, 0, 'growY', 4.1);

  const apseRoof = new THREE.Mesh(apseRoofGeo, mats.stoneApse);
  apseRoof.position.set(0, 10.8, -7.5);
  apseGroup.add(apseRoof);
  registerPart('apse', apseRoof, 0.4, 0.68, 5.2, 'drop');

  for (let i = 0; i < 7; i++) {
    const theta = Math.PI + (i / 6) * Math.PI;
    const cx = Math.cos(theta) * 5.35;
    const cz = -7.5 + Math.sin(theta) * 5.35;
    const st = (i / 6) * 0.18;

    const chapel = new THREE.Mesh(chapelGeo, mats.stoneApse);
    chapel.position.set(cx, 4.2, cz);
    apseGroup.add(chapel);
    registerPart('apse', chapel, 0.1 + st, 0.4 + st, 4.0, 'drop');

    const slit = new THREE.Mesh(chapelSlitGeo, mats.shadowRecessApse);
    slit.position.set(Math.cos(theta) * 6.32, 4.4, -7.5 + Math.sin(theta) * 6.32);
    slit.rotation.y = -theta + Math.PI / 2;
    apseGroup.add(slit);
    registerPart('apse', slit, 0.28 + st, 0.5 + st, 2.0, 'pop');

    const cRoof = new THREE.Mesh(chapelRoofGeo, mats.stoneApse);
    cRoof.position.set(cx, 8.6, cz);
    apseGroup.add(cRoof);
    registerPart('apse', cRoof, 0.4 + st, 0.64 + st, 4.8, 'drop');

    const fRib = new THREE.Mesh(flyingRibGeo, mats.stoneApse);
    fRib.position.set(Math.cos(theta) * 4.55, 8.75, -7.5 + Math.sin(theta) * 4.55);
    fRib.rotation.y = -theta + Math.PI / 2;
    fRib.rotation.x = 0.42;
    apseGroup.add(fRib);
    registerPart('apse', fRib, 0.46 + st, 0.68 + st, 4.6, 'drop');

    const pShaft = new THREE.Mesh(pinnacleShaftGeo, mats.stoneApse);
    pShaft.position.set(cx * 0.94, 9.5, -7.5 + Math.sin(theta) * 5.05);
    apseGroup.add(pShaft);
    registerPart('apse', pShaft, 0.54 + st, 0.76 + st, 5.5, 'drop');

    const pTip = new THREE.Mesh(pinnacleTipGeo, mats.stoneApse);
    pTip.position.set(cx * 0.94, 14.05, -7.5 + Math.sin(theta) * 5.05);
    apseGroup.add(pTip);
    registerPart('apse', pTip, 0.68 + st, Math.min(1.0, 0.84 + st), 5.5, 'drop');

    const pCap = new THREE.Mesh(pinnacleCapGeo, mats.finialNativityGold);
    pCap.position.set(cx * 0.94, 15.25, -7.5 + Math.sin(theta) * 5.05);
    apseGroup.add(pCap);
    registerPart('apse', pCap, 0.74 + st, Math.min(1.0, 0.92 + st), 4.5, 'drop');
  }
  addShadowProps(apseGroup);
  root.add(apseGroup);

  // Nativity Facade Body (+X East Transept) — Triple Nested Portals, Bronze Doors, Rose Tracery & Crest
  const nativityBodyGroup = new THREE.Group();
  const natWallCourseGeo = new THREE.BoxGeometry(2.4, 3.24, 8.2, 4, 6, 14);
  const natArchRecessGeo = new THREE.BoxGeometry(0.45, 4.4, 1.38);
  const natBronzeDoorGeo = new THREE.BoxGeometry(0.18, 3.4, 1.15);
  const natTrumeauGeo = new THREE.CylinderGeometry(0.11, 0.13, 3.6, 10, 4);
  const portalArchGeo = new THREE.ConeGeometry(1.52, 5.8, 4, 6);
  const natArchivoltGeo = new THREE.TorusGeometry(0.95, 0.14, 8, 16, Math.PI);
  const natRoseGeo = new THREE.TorusGeometry(0.58, 0.08, 8, 16);
  const galleryColGeo = new THREE.CylinderGeometry(0.14, 0.16, 2.2, 10, 3);
  const galleryEntabGeo = new THREE.BoxGeometry(0.6, 0.42, 7.6, 2, 2, 12);
  geometries.push(
    natWallCourseGeo,
    natArchRecessGeo,
    natBronzeDoorGeo,
    natTrumeauGeo,
    portalArchGeo,
    natArchivoltGeo,
    natRoseGeo,
    galleryColGeo,
    galleryEntabGeo
  );

  for (let c = 0; c < 3; c++) {
    const course = new THREE.Mesh(natWallCourseGeo, mats.stoneNativityBody);
    course.position.set(7.2, 2.6 + c * 3.2, 0);
    nativityBodyGroup.add(course);
    registerPart('nativityBody', course, c * 0.13, c * 0.13 + 0.24, 4.5, 'drop');
  }

  const portalZ = [-2.2, 0, 2.2];
  portalZ.forEach((pz, idx) => {
    const st = idx * 0.06;
    const recess = new THREE.Mesh(natArchRecessGeo, mats.shadowRecessCrypt);
    recess.position.set(8.25, 3.3, pz);
    nativityBodyGroup.add(recess);
    registerPart('nativityBody', recess, 0.18 + st, 0.4 + st, 2.5, 'pop');

    const bDoor = new THREE.Mesh(natBronzeDoorGeo, mats.bronzeNativity);
    bDoor.position.set(8.42, 2.7, pz);
    nativityBodyGroup.add(bDoor);
    registerPart('nativityBody', bDoor, 0.22 + st, 0.45 + st, 3.0, 'drop');

    const trumeau = new THREE.Mesh(natTrumeauGeo, mats.stoneNativityBody);
    trumeau.position.set(8.52, 2.8, pz);
    nativityBodyGroup.add(trumeau);
    registerPart('nativityBody', trumeau, 0.26 + st, 0.48 + st, 3.2, 'drop');

    const archRing = new THREE.Mesh(natArchivoltGeo, mats.stoneNativityBody);
    archRing.rotation.y = Math.PI / 2;
    archRing.position.set(8.45, 4.55, pz);
    nativityBodyGroup.add(archRing);
    registerPart('nativityBody', archRing, 0.3 + st, 0.52 + st, 4.0, 'drop');

    const gable = new THREE.Mesh(portalArchGeo, mats.stoneNativityBody);
    gable.rotation.y = Math.PI / 4;
    gable.scale.set(0.84, idx === 1 ? 1.42 : 1.08, 1.0);
    gable.position.set(8.25, idx === 1 ? 8.1 : 6.75, pz);
    nativityBodyGroup.add(gable);
    registerPart('nativityBody', gable, 0.34 + st, 0.58 + st, 5.5, 'drop');
  });

  const natRose = new THREE.Mesh(natRoseGeo, mats.stoneNativityBody);
  natRose.rotation.y = Math.PI / 2;
  natRose.position.set(8.56, 7.15, 0);
  nativityBodyGroup.add(natRose);
  registerPart('nativityBody', natRose, 0.48, 0.66, 3.0, 'pop');

  let gColIdx = 0;
  for (let gz = -3.4; gz <= 3.4; gz += 0.85) {
    const gCol = new THREE.Mesh(galleryColGeo, mats.stoneNativityBody);
    gCol.position.set(8.35, 9.8, gz);
    nativityBodyGroup.add(gCol);
    const st = (gColIdx / 9) * 0.18;
    registerPart('nativityBody', gCol, 0.5 + st, 0.68 + st, 4.2, 'drop');
    gColIdx++;
  }

  const gEntab = new THREE.Mesh(galleryEntabGeo, mats.stoneNativityBody);
  gEntab.position.set(8.35, 11.0, 0);
  nativityBodyGroup.add(gEntab);
  registerPart('nativityBody', gEntab, 0.64, 0.78, 4.4, 'drop');

  // Carved stone Nativity gable pinnacle finial (replaces misplaced green cone tree)
  const natCrestPillarGeo = new THREE.CylinderGeometry(0.24, 0.34, 1.9, 8);
  const natCrestCapGeo = new THREE.OctahedronGeometry(0.38, 0);
  geometries.push(natCrestPillarGeo, natCrestCapGeo);

  const natCrestPillar = new THREE.Mesh(natCrestPillarGeo, mats.stoneNativityBody);
  natCrestPillar.position.set(8.35, 12.1, 0);
  nativityBodyGroup.add(natCrestPillar);
  registerPart('nativityBody', natCrestPillar, 0.74, 0.9, 4.2, 'drop');

  const natCrestCap = new THREE.Mesh(natCrestCapGeo, mats.finialNativityGold);
  natCrestCap.position.set(8.35, 13.3, 0);
  nativityBodyGroup.add(natCrestCap);
  registerPart('nativityBody', natCrestCap, 0.84, 1.0, 4.6, 'drop');

  addShadowProps(nativityBodyGroup);
  root.add(nativityBodyGroup);

  // Nativity 4 Parabolic Perforated Bell Towers (+X)
  const nativityTowersGroup = new THREE.Group();
  const natZ = [-2.85, -1.0, 1.0, 2.85];
  const natHeights = [22.2, 24.4, 24.4, 22.2];
  const natStaggers = [0.06, 0.0, 0.1, 0.15];
  natZ.forEach((tz, i) => {
    const tower = buildHDTower({
      x: 7.45,
      z: tz,
      baseY: 1.0,
      shaftHeight: natHeights[i],
      baseRadius: 0.94,
      topRadius: 0.34,
      radialSegments: 16,
      ribCount: 10,
      louverBands: 14,
      stoneMat: mats.stoneNativityTowers,
      recessMat: mats.shadowRecessNativity,
      finialMat: mats.finialNativityGold,
      accentMat: mats.finialWhiteCeramic,
      trencadisMat: mats.trencadisNativity,
      angularFinial: false,
      geometries,
      phase: 'nativityTowers',
      stagger: natStaggers[i],
      registerPart,
    });
    nativityTowersGroup.add(tower);
  });

  const bridgeGeo = new THREE.BoxGeometry(0.95, 1.45, 5.9);
  const bridgeArchGeo = new THREE.BoxGeometry(1.02, 0.72, 1.15);
  geometries.push(bridgeGeo, bridgeArchGeo);
  const natBridge = new THREE.Mesh(bridgeGeo, mats.stoneNativityTowers);
  natBridge.position.set(7.45, 15.2, 0);
  nativityTowersGroup.add(natBridge);
  registerPart('nativityTowers', natBridge, 0.52, 0.68, 5.0, 'drop');

  const natBridgeWin = new THREE.Mesh(bridgeArchGeo, mats.shadowRecessNativity);
  natBridgeWin.position.set(7.45, 15.1, 0);
  nativityTowersGroup.add(natBridgeWin);
  registerPart('nativityTowers', natBridgeWin, 0.56, 0.72, 2.5, 'pop');

  addShadowProps(nativityTowersGroup);
  root.add(nativityTowersGroup);

  // ------------------------------------------------------------------
  // PHASE 2 (1952–1976): Passion Facade (-X West Transept)
  // ------------------------------------------------------------------
  const passionBodyGroup = new THREE.Group();
  const passionWallCourseGeo = new THREE.BoxGeometry(2.2, 3.3, 8.2, 4, 6, 14);
  const passionShadowNarthexGeo = new THREE.BoxGeometry(0.5, 7.6, 6.8);
  const passionBronzeDoorGeo = new THREE.BoxGeometry(0.22, 4.2, 2.2);
  const passionCrossBarGeo = new THREE.BoxGeometry(0.24, 3.8, 0.24);
  const passionCrossArmGeo = new THREE.BoxGeometry(0.24, 0.24, 1.9);
  const corniceGeo = new THREE.BoxGeometry(2.7, 1.55, 8.9, 4, 3, 14);
  const bonePillarGeo = new THREE.CylinderGeometry(0.32, 0.45, 9.6, 6, 10);
  const boneTendonGeo = new THREE.CylinderGeometry(0.16, 0.22, 9.2, 5, 8);
  const upperRibGeo = new THREE.CylinderGeometry(0.2, 0.28, 3.8, 6, 4);
  const passionPedimentGeo = new THREE.ConeGeometry(2.8, 4.3, 3, 4);
  geometries.push(
    passionWallCourseGeo,
    passionShadowNarthexGeo,
    passionBronzeDoorGeo,
    passionCrossBarGeo,
    passionCrossArmGeo,
    corniceGeo,
    bonePillarGeo,
    boneTendonGeo,
    upperRibGeo,
    passionPedimentGeo
  );

  for (let c = 0; c < 3; c++) {
    const pCourse = new THREE.Mesh(passionWallCourseGeo, mats.stonePassionBody);
    pCourse.position.set(-7.1, 2.63 + c * 3.27, 0);
    passionBodyGroup.add(pCourse);
    registerPart('passionBody', pCourse, c * 0.12, c * 0.12 + 0.24, 4.5, 'drop');
  }

  const pNarthex = new THREE.Mesh(passionShadowNarthexGeo, mats.shadowRecessCrypt);
  pNarthex.position.set(-8.05, 4.9, 0);
  passionBodyGroup.add(pNarthex);
  registerPart('passionBody', pNarthex, 0.18, 0.42, 2.5, 'pop');

  const pDoors = new THREE.Mesh(passionBronzeDoorGeo, mats.bronzePassion);
  pDoors.position.set(-8.22, 3.1, 0);
  passionBodyGroup.add(pDoors);
  registerPart('passionBody', pDoors, 0.22, 0.46, 3.0, 'drop');

  const pCrossV = new THREE.Mesh(passionCrossBarGeo, mats.finialPassion);
  pCrossV.position.set(-8.36, 7.1, 0);
  passionBodyGroup.add(pCrossV);
  registerPart('passionBody', pCrossV, 0.45, 0.65, 3.2, 'drop');

  const pCrossH = new THREE.Mesh(passionCrossArmGeo, mats.finialPassion);
  pCrossH.position.set(-8.36, 8.15, 0);
  passionBodyGroup.add(pCrossH);
  registerPart('passionBody', pCrossH, 0.5, 0.7, 3.0, 'drop');

  const cornice = new THREE.Mesh(corniceGeo, mats.stonePassionBody);
  cornice.position.set(-8.65, 9.6, 0);
  passionBodyGroup.add(cornice);
  registerPart('passionBody', cornice, 0.58, 0.78, 6.5, 'drop');

  const boneZ = [-3.4, -2.04, -0.68, 0.68, 2.04, 3.4];
  boneZ.forEach((bz, idx) => {
    const st = idx * 0.04;
    const pillar = new THREE.Mesh(bonePillarGeo, mats.stonePassionBody);
    pillar.position.set(-9.15, 5.1, bz);
    pillar.rotation.z = idx % 2 === 0 ? -0.14 : -0.22;
    pillar.rotation.x = idx % 2 === 0 ? 0.05 : -0.05;
    passionBodyGroup.add(pillar);
    registerPart('passionBody', pillar, 0.3 + st, 0.55 + st, 5.8, 'drop');

    // Parallel muscular stone tendon rib giving the signature twin-bone profile
    const tendon = new THREE.Mesh(boneTendonGeo, mats.stonePassionBody);
    tendon.position.set(-8.82, 5.05, bz);
    tendon.rotation.z = idx % 2 === 0 ? -0.1 : -0.18;
    passionBodyGroup.add(tendon);
    registerPart('passionBody', tendon, 0.34 + st, 0.58 + st, 5.2, 'drop');

    const upperRib = new THREE.Mesh(upperRibGeo, mats.stonePassionBody);
    upperRib.position.set(-8.15, 11.6, bz);
    upperRib.rotation.z = 0.24;
    passionBodyGroup.add(upperRib);
    registerPart('passionBody', upperRib, 0.72 + idx * 0.025, 0.86 + idx * 0.025, 5.0, 'drop');
  });

  const passionPediment = new THREE.Mesh(passionPedimentGeo, mats.stonePassionBody);
  passionPediment.rotation.y = Math.PI / 6;
  passionPediment.scale.set(0.45, 1.0, 1.45);
  passionPediment.position.set(-8.3, 12.2, 0);
  passionBodyGroup.add(passionPediment);
  registerPart('passionBody', passionPediment, 0.84, 1.0, 6.0, 'drop');
  addShadowProps(passionBodyGroup);
  root.add(passionBodyGroup);

  // Passion 4 Angular Perforated Bell Towers (-X)
  const passionTowersGroup = new THREE.Group();
  const passionHeights = [23.8, 25.4, 25.4, 23.8];
  const passionStaggers = [0.02, 0.07, 0.07, 0.12];
  natZ.forEach((tz, i) => {
    const tower = buildHDTower({
      x: -7.45,
      z: tz,
      baseY: 1.0,
      shaftHeight: passionHeights[i],
      baseRadius: 0.96,
      topRadius: 0.36,
      radialSegments: 8,
      ribCount: 6,
      louverBands: 14,
      stoneMat: mats.stonePassionTowers,
      recessMat: mats.shadowRecessPassion,
      finialMat: mats.finialPassion,
      accentMat: mats.finialPassion,
      angularFinial: true,
      geometries,
      phase: 'passionTowers',
      stagger: passionStaggers[i],
      registerPart,
    });
    passionTowersGroup.add(tower);
  });
  const passionBridge = new THREE.Mesh(bridgeGeo, mats.stonePassionTowers);
  passionBridge.position.set(-7.45, 16.0, 0);
  passionTowersGroup.add(passionBridge);
  registerPart('passionTowers', passionBridge, 0.54, 0.7, 5.0, 'drop');

  const passionBridgeWin = new THREE.Mesh(bridgeArchGeo, mats.shadowRecessPassion);
  passionBridgeWin.position.set(-7.45, 15.9, 0);
  passionTowersGroup.add(passionBridgeWin);
  registerPart('passionTowers', passionBridgeWin, 0.58, 0.74, 2.5, 'pop');

  addShadowProps(passionTowersGroup);
  root.add(passionTowersGroup);

  // ------------------------------------------------------------------
  // PHASE 3 (1978–2010): Central Nave, Triangular Gable Bays, Forest Columns & Vaults
  // ------------------------------------------------------------------
  const naveWallsGroup = new THREE.Group();

  const aisleBayGeo = new THREE.BoxGeometry(0.65, 7.6, 5.55, 2, 10, 8);
  const clerestoryBayGeo = new THREE.BoxGeometry(0.55, 10.6, 5.55, 2, 12, 8);
  const transeptConnectGeo = new THREE.BoxGeometry(13.0, 9.6, 0.65, 14, 10, 2);
  const aisleButtressGeo = new THREE.BoxGeometry(0.95, 7.2, 0.34, 2, 8, 2);
  const stainedPanelGeo = new THREE.PlaneGeometry(1.65, 5.4);
  const aisleGlassGeo = new THREE.PlaneGeometry(1.35, 4.4);
  const windowFrameGeo = new THREE.BoxGeometry(0.22, 5.8, 1.85);
  const mullionBarGeo = new THREE.BoxGeometry(0.26, 5.4, 0.12);
  const zigGableGeo = new THREE.ConeGeometry(1.18, 3.2, 4, 4);
  const oculusDarkGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.72, 12);
  const oculusRimGeo = new THREE.TorusGeometry(0.4, 0.07, 6, 12);
  geometries.push(
    aisleBayGeo,
    clerestoryBayGeo,
    transeptConnectGeo,
    aisleButtressGeo,
    stainedPanelGeo,
    aisleGlassGeo,
    windowFrameGeo,
    mullionBarGeo,
    zigGableGeo,
    oculusDarkGeo,
    oculusRimGeo
  );

  const bayZCenters = [-5.05, 0.4, 5.85];
  bayZCenters.forEach((bz, bIdx) => {
    const bSt = bIdx * 0.14;
    for (const side of [-1, 1]) {
      const aisleBay = new THREE.Mesh(aisleBayGeo, mats.stoneNaveWalls);
      aisleBay.position.set(side * 4.45, 4.8, bz);
      naveWallsGroup.add(aisleBay);
      registerPart('naveWalls', aisleBay, bSt, bSt + 0.28, 4.5, 'drop');

      const clereBay = new THREE.Mesh(clerestoryBayGeo, mats.stoneNaveWalls);
      clereBay.position.set(side * 2.4, 6.3, bz);
      naveWallsGroup.add(clereBay);
      registerPart('naveWalls', clereBay, 0.12 + bSt, 0.4 + bSt, 5.2, 'drop');
    }
  });

  for (const side of [-1, 1]) {
    const trWall = new THREE.Mesh(transeptConnectGeo, mats.stoneNaveWalls);
    trWall.position.set(0, 5.8, side * 3.85);
    naveWallsGroup.add(trWall);
    registerPart('naveWalls', trWall, 0.08, 0.36, 4.8, 'drop');
  }

  const windowZPositions = [-5.8, -4.0, -2.0, 2.0, 4.0, 5.8, 7.5];
  windowZPositions.forEach((wz, wIdx) => {
    const wSt = (wIdx / windowZPositions.length) * 0.24;
    for (const side of [-1, 1]) {
      const buttress = new THREE.Mesh(aisleButtressGeo, mats.stoneNaveWalls);
      buttress.position.set(side * 4.78, 4.6, wz + 0.9);
      naveWallsGroup.add(buttress);
      registerPart('naveWalls', buttress, 0.22 + wSt, 0.45 + wSt, 4.5, 'drop');

      const frame = new THREE.Mesh(windowFrameGeo, mats.shadowRecessNave);
      frame.position.set(side * 2.62, 8.2, wz);
      naveWallsGroup.add(frame);
      registerPart('naveWalls', frame, 0.4 + wSt, 0.62 + wSt, 3.5, 'drop');

      const mullion = new THREE.Mesh(mullionBarGeo, mats.stoneNaveWalls);
      mullion.position.set(side * 2.78, 8.2, wz);
      naveWallsGroup.add(mullion);
      registerPart('naveWalls', mullion, 0.44 + wSt, 0.66 + wSt, 3.2, 'drop');

      const clereGlass = new THREE.Mesh(stainedPanelGeo, mats.stainedGlass);
      clereGlass.rotation.y = Math.PI / 2;
      clereGlass.position.set(side * 2.75, 8.2, wz);
      naveWallsGroup.add(clereGlass);
      registerPart('naveWalls', clereGlass, 0.46 + wSt, 0.68 + wSt, 3.8, 'drop');

      const aisleGlass = new THREE.Mesh(aisleGlassGeo, mats.stainedGlass);
      aisleGlass.rotation.y = Math.PI / 2;
      aisleGlass.position.set(side * 4.82, 5.0, wz);
      naveWallsGroup.add(aisleGlass);
      registerPart('naveWalls', aisleGlass, 0.42 + wSt, 0.64 + wSt, 3.5, 'drop');
    }
  });

  // Iconic repeating triangular pointed Gables + framed Rose Oculi along aisle walls
  let gBayIdx = 0;
  for (let gz = -6.4; gz <= 7.8; gz += 1.75) {
    const gSt = (gBayIdx / 9) * 0.24;
    for (const side of [-1, 1]) {
      const gable = new THREE.Mesh(zigGableGeo, mats.stoneNaveWalls);
      gable.rotation.y = Math.PI / 4;
      gable.scale.set(0.55, 1.0, 1.0);
      gable.position.set(side * 4.45, 9.6, gz);
      naveWallsGroup.add(gable);
      registerPart('naveWalls', gable, 0.62 + gSt, 0.84 + gSt, 4.5, 'drop');

      const oculus = new THREE.Mesh(oculusDarkGeo, mats.shadowRecessNave);
      oculus.rotation.z = Math.PI / 2;
      oculus.position.set(side * 4.45, 8.95, gz);
      naveWallsGroup.add(oculus);
      registerPart('naveWalls', oculus, 0.68 + gSt, 0.88 + gSt, 2.0, 'pop');

      const ocRim = new THREE.Mesh(oculusRimGeo, mats.stoneNaveWalls);
      ocRim.rotation.y = Math.PI / 2;
      ocRim.position.set(side * 4.82, 8.95, gz);
      naveWallsGroup.add(ocRim);
      registerPart('naveWalls', ocRim, 0.7 + gSt, 0.9 + gSt, 2.0, 'pop');
    }
    gBayIdx++;
  }

  // Interior Forest of Branching Tree Columns (plinth -> fluted trunk -> capital -> 4 branches)
  const colPlinthGeo = new THREE.CylinderGeometry(0.48, 0.56, 0.8, 10, 2);
  const trunkColGeo = new THREE.CylinderGeometry(0.28, 0.38, 6.2, 12, 6);
  const branchGeo = new THREE.CylinderGeometry(0.11, 0.18, 3.6, 8, 4);
  const capitalDiscGeo = new THREE.CylinderGeometry(1.05, 0.32, 0.9, 12, 2);
  geometries.push(colPlinthGeo, trunkColGeo, branchGeo, capitalDiscGeo);

  const colZ = [-5.6, -2.8, 0, 2.8, 5.6, 8.2];
  colZ.forEach((cz, cIdx) => {
    const cSt = (cIdx / colZ.length) * 0.32;
    for (const side of [-1, 1]) {
      const colGroup = new THREE.Group();
      colGroup.position.set(side * 2.1, 1.0, cz);

      const cPlinth = new THREE.Mesh(colPlinthGeo, mats.stoneNaveWalls);
      cPlinth.position.y = 0.4;
      colGroup.add(cPlinth);
      registerPart('naveWalls', cPlinth, 0.05 + cSt, 0.25 + cSt, 3.5, 'drop');

      const trunk = new THREE.Mesh(trunkColGeo, mats.stoneNaveWalls);
      trunk.position.y = 3.1;
      colGroup.add(trunk);
      registerPart('naveWalls', trunk, 0.1 + cSt, 0.34 + cSt, 4.8, 'drop');

      const cap = new THREE.Mesh(capitalDiscGeo, mats.stoneNaveWalls);
      cap.position.y = 6.3;
      colGroup.add(cap);
      registerPart('naveWalls', cap, 0.28 + cSt, 0.48 + cSt, 4.2, 'drop');

      for (let b = 0; b < 4; b++) {
        const ang = (b / 4) * Math.PI * 2 + Math.PI / 4;
        const branch = new THREE.Mesh(branchGeo, mats.stoneNaveWalls);
        branch.position.set(Math.cos(ang) * 0.65, 8.0, Math.sin(ang) * 0.65);
        branch.rotation.z = -Math.cos(ang) * 0.36;
        branch.rotation.x = Math.sin(ang) * 0.36;
        colGroup.add(branch);
        registerPart('naveWalls', branch, 0.42 + cSt, Math.min(0.95, 0.62 + cSt), 4.2, 'drop');
      }
      naveWallsGroup.add(colGroup);
    }
  });

  addShadowProps(naveWallsGroup);
  root.add(naveWallsGroup);

  // Phase 3B: Hyperboloid Roof Vaults, Triangular Dormers & Trencadis Pinnacles
  const naveVaultsGroup = new THREE.Group();

  const centralRoofSegGeo = new THREE.CylinderGeometry(2.65, 2.65, 5.75, 8, 1, false, 0, Math.PI);
  centralRoofSegGeo.rotateZ(Math.PI / 2);
  centralRoofSegGeo.rotateY(Math.PI / 2);
  const sideRoofSegGeo = new THREE.BoxGeometry(2.3, 0.55, 5.6);
  const transeptRoofGeo = new THREE.BoxGeometry(13.6, 0.8, 7.6);
  const dormerGableGeo = new THREE.ConeGeometry(1.1, 2.5, 4);
  const oculusGeo = new THREE.CylinderGeometry(0.42, 0.78, 1.35, 10);
  const oculusCapGeo = new THREE.IcosahedronGeometry(0.42, 1);
  const eavePinnacleGeo = new THREE.ConeGeometry(0.32, 1.85, 8);
  const eaveFruitGeo = new THREE.IcosahedronGeometry(0.3, 1);
  geometries.push(
    centralRoofSegGeo,
    sideRoofSegGeo,
    transeptRoofGeo,
    dormerGableGeo,
    oculusGeo,
    oculusCapGeo,
    eavePinnacleGeo,
    eaveFruitGeo
  );

  bayZCenters.forEach((bz, bIdx) => {
    const rSt = bIdx * 0.14;
    const cSeg = new THREE.Mesh(centralRoofSegGeo, mats.roofTerracotta);
    cSeg.scale.set(1.0, 0.95, 1.0);
    cSeg.position.set(0, 11.4, bz);
    naveVaultsGroup.add(cSeg);
    registerPart('naveVaults', cSeg, 0.24 + rSt, 0.54 + rSt, 6.2, 'drop');

    for (const side of [-1, 1]) {
      const sSeg = new THREE.Mesh(sideRoofSegGeo, mats.roofTerracotta);
      sSeg.position.set(side * 3.55, 8.5, bz);
      sSeg.rotation.z = side * -0.24;
      naveVaultsGroup.add(sSeg);
      registerPart('naveVaults', sSeg, 0.12 + rSt, 0.4 + rSt, 5.2, 'drop');
    }
  });

  const trRoof = new THREE.Mesh(transeptRoofGeo, mats.roofTerracotta);
  trRoof.position.set(0, 10.6, 0);
  naveVaultsGroup.add(trRoof);
  registerPart('naveVaults', trRoof, 0.04, 0.32, 5.5, 'drop');

  let roofRowIdx = 0;
  for (let z = -6.0; z <= 6.5; z += 2.2) {
    const rowSt = (roofRowIdx / 6) * 0.22;
    const oculus = new THREE.Mesh(oculusGeo, mats.stoneNaveVaults);
    oculus.position.set(0, 13.9, z);
    naveVaultsGroup.add(oculus);
    registerPart('naveVaults', oculus, 0.54 + rowSt, 0.74 + rowSt, 4.8, 'drop');

    const oCap = new THREE.Mesh(oculusCapGeo, mats.trencadisNativity);
    oCap.position.set(0, 14.75, z);
    naveVaultsGroup.add(oCap);
    registerPart('naveVaults', oCap, 0.68 + rowSt, Math.min(1.0, 0.86 + rowSt), 4.5, 'drop');

    for (const side of [-1, 1]) {
      const dormer = new THREE.Mesh(dormerGableGeo, mats.stoneNaveVaults);
      dormer.rotation.y = Math.PI / 4;
      dormer.position.set(side * 2.1, 11.5, z);
      naveVaultsGroup.add(dormer);
      registerPart('naveVaults', dormer, 0.48 + rowSt, 0.68 + rowSt, 4.8, 'drop');

      const pin = new THREE.Mesh(eavePinnacleGeo, mats.stoneNaveVaults);
      pin.position.set(side * 2.48, 12.35, z);
      naveVaultsGroup.add(pin);
      registerPart('naveVaults', pin, 0.58 + rowSt, 0.78 + rowSt, 4.8, 'drop');

      const fruit = new THREE.Mesh(eaveFruitGeo, mats.trencadisNativity);
      fruit.position.set(side * 2.48, 13.45, z);
      naveVaultsGroup.add(fruit);
      registerPart('naveVaults', fruit, 0.72 + rowSt, Math.min(1.0, 0.9 + rowSt), 4.5, 'drop');
    }
    roofRowIdx++;
  }

  const shoulderGeo = new THREE.ConeGeometry(1.75, 5.4, 4);
  geometries.push(shoulderGeo);
  [
    [0, -3.5],
    [0, 3.5],
    [-3.5, 0],
    [3.5, 0],
  ].forEach(([sx, sz], idx) => {
    const sh = new THREE.Mesh(shoulderGeo, mats.stoneNaveVaults);
    sh.rotation.y = Math.PI / 4;
    sh.position.set(sx, 13.4, sz);
    naveVaultsGroup.add(sh);
    registerPart('naveVaults', sh, 0.5 + idx * 0.04, 0.74 + idx * 0.04, 5.5, 'drop');
  });

  addShadowProps(naveVaultsGroup);
  root.add(naveVaultsGroup);

  // ------------------------------------------------------------------
  // PHASE 4 (2010–2026+): Central Towers, Virgin Mary Star, Jesus Cross & Glory Facade
  // ------------------------------------------------------------------

  // 4A. Four Evangelist Towers (135m -> ~33.75 units)
  const evangelistTowersGroup = new THREE.Group();
  const evCoords: [number, number][] = [
    [-2.45, -2.45],
    [2.45, -2.45],
    [-2.45, 2.45],
    [2.45, 2.45],
  ];
  const wingGeo = new THREE.BoxGeometry(1.95, 0.52, 0.2);
  const tetramorphGeo = new THREE.OctahedronGeometry(0.68, 0);
  const haloRingGeo = new THREE.TorusGeometry(0.84, 0.08, 6, 12);
  geometries.push(wingGeo, tetramorphGeo, haloRingGeo);

  evCoords.forEach(([ex, ez], idx) => {
    const st = idx * 0.035;
    const evTower = buildHDTower({
      x: ex,
      z: ez,
      baseY: 10.2,
      shaftHeight: 20.6,
      baseRadius: 1.08,
      topRadius: 0.48,
      radialSegments: 12,
      ribCount: 8,
      louverBands: 12,
      stoneMat: mats.stoneEvangelists,
      recessMat: mats.shadowRecessEvan,
      finialMat: mats.finialEvangelists,
      accentMat: mats.finialNativityGold,
      angularFinial: true,
      geometries,
      phase: 'evangelistTowers',
      stagger: st,
      registerPart,
    });

    const wingGroup = new THREE.Group();
    wingGroup.position.set(0, 23.9, 0);
    wingGroup.rotation.y = (idx * Math.PI) / 2 + Math.PI / 4;

    const leftWing = new THREE.Mesh(wingGeo, mats.finialEvangelists);
    leftWing.position.set(-0.84, 0.25, 0);
    leftWing.rotation.z = 0.45;
    wingGroup.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, mats.finialEvangelists);
    rightWing.position.set(0.84, 0.25, 0);
    rightWing.rotation.z = -0.45;
    wingGroup.add(rightWing);

    const emblem = new THREE.Mesh(tetramorphGeo, mats.finialEvangelists);
    emblem.position.y = 0.42;
    wingGroup.add(emblem);

    const halo = new THREE.Mesh(haloRingGeo, mats.finialNativityGold);
    halo.position.y = 0.42;
    wingGroup.add(halo);

    evTower.add(wingGroup);
    registerPart('evangelistTowers', wingGroup, 0.84 + st * 0.4, Math.min(1.0, 0.96 + st * 0.4), 6.2, 'drop');
    evangelistTowersGroup.add(evTower);
  });
  addShadowProps(evangelistTowersGroup);
  root.add(evangelistTowersGroup);

  // 4B. Tower of the Virgin Mary (138m -> 34.5 units)
  const virginMaryTowerGroup = new THREE.Group();
  const vmTower = buildHDTower({
    x: 0,
    z: -6.4,
    baseY: 9.8,
    shaftHeight: 21.8,
    baseRadius: 1.78,
    topRadius: 0.72,
    radialSegments: 12,
    ribCount: 12,
    louverBands: 14,
    stoneMat: mats.stoneVirginMary,
    recessMat: mats.shadowRecessMary,
    finialMat: mats.finialEvangelists,
    accentMat: mats.finialNativityGold,
    trencadisMat: mats.trencadisVirginMary,
    angularFinial: false,
    geometries,
    phase: 'virginMaryTower',
    stagger: 0,
    registerPart,
  });
  virginMaryTowerGroup.add(vmTower);

  const starMesh = createTwelvePointedStar(mats.starVirginMary, geometries);
  starMesh.position.set(0, 35.75, -6.4);
  virginMaryTowerGroup.add(starMesh);
  registerPart('virginMaryTower', starMesh, 0.85, 1.0, 7.5, 'drop');

  const starLight = new THREE.PointLight(0xffd275, 0, 24, 1.5);
  starLight.position.set(0, 35.75, -6.4);
  virginMaryTowerGroup.add(starLight);
  addShadowProps(virginMaryTowerGroup);
  root.add(virginMaryTowerGroup);

  // 4C. Central Tower of Jesus Christ (172.5m -> 43.1 units) stacked course-by-course
  const jesusTowerGroup = new THREE.Group();
  jesusTowerGroup.position.set(0, 0, 0);

  const drumGeo = new THREE.CylinderGeometry(2.58, 2.92, 4.8, 24, 5);
  const drumLancetGeo = new THREE.BoxGeometry(0.42, 3.2, 0.16);
  const jRibGeo = new THREE.BoxGeometry(0.22, 24.4, 0.42, 2, 16, 2);
  const jTriangleGableGeo = new THREE.ConeGeometry(0.84, 3.8, 4, 4);
  const terminalCollarGeo = new THREE.CylinderGeometry(0.76, 1.12, 2.4, 16, 3);
  const terminalGalleryRingGeo = new THREE.TorusGeometry(1.14, 0.12, 8, 20);
  geometries.push(drumGeo, drumLancetGeo, jRibGeo, jTriangleGableGeo, terminalCollarGeo, terminalGalleryRingGeo);

  const drum = new THREE.Mesh(drumGeo, mats.stoneJesusTower);
  drum.position.y = 12.2;
  jesusTowerGroup.add(drum);
  registerPart('jesusTower', drum, 0.0, 0.16, 5.5, 'drop');

  // 12 vertical buttress ribs + crossing drum lancets + triangular shoulder gables
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const midR = 1.72;
    const jRib = new THREE.Mesh(jRibGeo, mats.stoneJesusTower);
    jRib.position.set(Math.cos(ang) * midR, 26.0, Math.sin(ang) * midR);
    jRib.rotation.y = -ang;
    jRib.rotation.z = 0.055;
    jesusTowerGroup.add(jRib);
    registerPart('jesusTower', jRib, 0.22, 0.78, 0, 'growY', 12.2);

    const drumLancet = new THREE.Mesh(drumLancetGeo, mats.shadowRecessJesus);
    drumLancet.position.set(Math.cos(ang) * 2.75, 12.4, Math.sin(ang) * 2.75);
    drumLancet.rotation.y = -ang + Math.PI / 2;
    jesusTowerGroup.add(drumLancet);
    registerPart('jesusTower', drumLancet, 0.06, 0.2, 2.5, 'pop');

    if (i % 2 === 0) {
      const jGable = new THREE.Mesh(jTriangleGableGeo, mats.stoneJesusTower);
      jGable.position.set(Math.cos(ang) * 2.54, 15.85, Math.sin(ang) * 2.54);
      jGable.rotation.y = -ang + Math.PI / 4;
      jesusTowerGroup.add(jGable);
      registerPart('jesusTower', jGable, 0.12 + (i / 12) * 0.1, 0.26 + (i / 12) * 0.1, 4.5, 'drop');
    }
  }

  // 11 stacked parabolic masonry drums + perforated lattice window tiers + stone belts
  const jesusTiers = 11;
  for (let tier = 0; tier < jesusTiers; tier++) {
    const t0 = tier / jesusTiers;
    const t1 = (tier + 1) / jesusTiers;
    const r0 = THREE.MathUtils.lerp(2.38, 0.92, Math.pow(t0, 0.78));
    const r1 = THREE.MathUtils.lerp(2.38, 0.92, Math.pow(t1, 0.78));
    const segH = 26.2 / jesusTiers;

    const jDrumGeo = new THREE.CylinderGeometry(r1, r0, segH * 1.02, 24, 4);
    geometries.push(jDrumGeo);
    const jDrum = new THREE.Mesh(jDrumGeo, mats.stoneJesusTower);
    jDrum.position.y = 13.8 + (t0 + t1) * 0.5 * 26.2;
    jesusTowerGroup.add(jDrum);

    const tStart = 0.14 + t0 * 0.58;
    const tEnd = Math.min(0.84, tStart + 0.14);
    registerPart('jesusTower', jDrum, tStart, tEnd, 6.2, 'drop');

    const frac = 0.1 + t0 * 0.84;
    const yPos = 14.2 + frac * 25.0;
    const r = THREE.MathUtils.lerp(2.36, 0.94, Math.pow(frac, 0.78));

    const winSlotGeo = new THREE.CylinderGeometry(r * 1.01, r * 1.02, 0.55, 12);
    const beltGeo = new THREE.TorusGeometry(r * 1.055, 0.115, 6, 16);
    geometries.push(winSlotGeo, beltGeo);

    const winSlot = new THREE.Mesh(winSlotGeo, mats.shadowRecessJesus);
    winSlot.position.y = yPos;
    jesusTowerGroup.add(winSlot);
    registerPart('jesusTower', winSlot, tStart + 0.02, Math.min(0.86, tEnd + 0.02), 3.2, 'pop');

    const belt = new THREE.Mesh(beltGeo, mats.stoneJesusTower);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = yPos + 0.36;
    jesusTowerGroup.add(belt);
    registerPart('jesusTower', belt, tStart + 0.03, Math.min(0.88, tEnd + 0.03), 5.0, 'drop');
  }

  const terminalCollar = new THREE.Mesh(terminalCollarGeo, mats.stoneJesusTower);
  terminalCollar.position.y = 39.85;
  jesusTowerGroup.add(terminalCollar);
  registerPart('jesusTower', terminalCollar, 0.76, 0.9, 6.0, 'drop');

  const terminalGallery = new THREE.Mesh(terminalGalleryRingGeo, mats.stoneJesusTower);
  terminalGallery.rotation.x = Math.PI / 2;
  terminalGallery.position.y = 38.9;
  jesusTowerGroup.add(terminalGallery);
  registerPart('jesusTower', terminalGallery, 0.74, 0.88, 5.2, 'drop');

  const fourArmedCross = createFourArmedCross(
    mats.crossJesusTower,
    mats.finialNativityGold,
    geometries
  );
  fourArmedCross.position.set(0, 40.35, 0);
  jesusTowerGroup.add(fourArmedCross);
  registerPart('jesusTower', fourArmedCross, 0.86, 1.0, 8.5, 'drop');

  addShadowProps(jesusTowerGroup);
  root.add(jesusTowerGroup);

  // 4D. Glory Facade (+Z South Entrance) — Monumental Stairs, Bronze Doors, Solar Rays & Colonnade
  const gloryFacadeGroup = new THREE.Group();
  const gloryWallCourseGeo = new THREE.BoxGeometry(8.6, 3.56, 2.2, 14, 6, 4);
  const gloryRecessGeo = new THREE.BoxGeometry(6.8, 7.2, 0.45);
  const gloryBronzeDoorsGeo = new THREE.BoxGeometry(4.4, 5.2, 0.22);
  const gloryStairGeo = new THREE.BoxGeometry(9.4, 0.36, 1.8, 12, 1, 3);
  const gloryColGeo = new THREE.CylinderGeometry(0.32, 0.44, 10.6, 12, 8);
  const glorySunGableGeo = new THREE.CylinderGeometry(3.9, 3.9, 0.95, 24, 2, false, 0, Math.PI);
  const glorySunRayGeo = new THREE.BoxGeometry(0.2, 2.9, 0.35);
  geometries.push(
    gloryWallCourseGeo,
    gloryRecessGeo,
    gloryBronzeDoorsGeo,
    gloryStairGeo,
    gloryColGeo,
    glorySunGableGeo,
    glorySunRayGeo
  );

  for (let s = 0; s < 3; s++) {
    const stair = new THREE.Mesh(gloryStairGeo, mats.stoneGloryFacade);
    stair.position.set(0, 0.18 + s * 0.34, 12.6 - s * 0.55);
    gloryFacadeGroup.add(stair);
    registerPart('gloryFacade', stair, 0.0 + s * 0.04, 0.16 + s * 0.04, 2.8, 'drop');
  }

  for (let c = 0; c < 3; c++) {
    const gCourse = new THREE.Mesh(gloryWallCourseGeo, mats.stoneGloryFacade);
    gCourse.position.set(0, 2.67 + c * 3.53, 9.6);
    gloryFacadeGroup.add(gCourse);
    registerPart('gloryFacade', gCourse, c * 0.11, c * 0.11 + 0.22, 4.5, 'drop');
  }

  const gloryRecess = new THREE.Mesh(gloryRecessGeo, mats.shadowRecessGlory);
  gloryRecess.position.set(0, 4.8, 10.65);
  gloryFacadeGroup.add(gloryRecess);
  registerPart('gloryFacade', gloryRecess, 0.16, 0.4, 2.5, 'pop');

  const gloryDoors = new THREE.Mesh(gloryBronzeDoorsGeo, mats.bronzeGlory);
  gloryDoors.position.set(0, 3.6, 10.85);
  gloryFacadeGroup.add(gloryDoors);
  registerPart('gloryFacade', gloryDoors, 0.2, 0.44, 3.2, 'drop');

  for (let i = -3; i <= 3; i++) {
    const gCol = new THREE.Mesh(gloryColGeo, mats.stoneGloryFacade);
    gCol.position.set(i * 1.15, 6.2, 11.25);
    gloryFacadeGroup.add(gCol);
    const st = ((i + 3) / 6) * 0.16;
    registerPart('gloryFacade', gCol, 0.22 + st, 0.44 + st, 5.5, 'drop');
  }

  const gloryGable = new THREE.Mesh(glorySunGableGeo, mats.stoneGloryFacade);
  gloryGable.rotation.x = Math.PI / 2;
  gloryGable.rotation.y = Math.PI;
  gloryGable.position.set(0, 11.4, 10.6);
  gloryFacadeGroup.add(gloryGable);
  registerPart('gloryFacade', gloryGable, 0.42, 0.62, 5.5, 'drop');

  for (let r = -3; r <= 3; r++) {
    const rayAng = r * 0.24;
    const sunRay = new THREE.Mesh(glorySunRayGeo, mats.finialNativityGold);
    sunRay.position.set(Math.sin(rayAng) * 2.5, 11.8 + Math.cos(rayAng) * 2.1, 11.12);
    sunRay.rotation.z = -rayAng;
    gloryFacadeGroup.add(sunRay);
    registerPart('gloryFacade', sunRay, 0.46 + (r + 3) * 0.02, 0.66 + (r + 3) * 0.02, 3.5, 'pop');
  }

  const gloryX = [-2.85, -1.0, 1.0, 2.85];
  const gloryHeights = [24.2, 26.5, 26.5, 24.2];
  const gloryStaggers = [0.06, 0.0, 0.04, 0.1];
  gloryX.forEach((gx, i) => {
    const gTower = buildHDTower({
      x: gx,
      z: 10.35,
      baseY: 1.0,
      shaftHeight: gloryHeights[i],
      baseRadius: 0.96,
      topRadius: 0.36,
      radialSegments: 12,
      ribCount: 8,
      louverBands: 14,
      stoneMat: mats.stoneGloryFacade,
      recessMat: mats.shadowRecessGlory,
      finialMat: mats.finialNativityGold,
      accentMat: mats.finialWhiteCeramic,
      trencadisMat: mats.trencadisNativity,
      angularFinial: false,
      geometries,
      phase: 'gloryFacade',
      stagger: gloryStaggers[i],
      registerPart,
    });
    gloryFacadeGroup.add(gTower);
  });

  addShadowProps(gloryFacadeGroup);
  root.add(gloryFacadeGroup);

  // ------------------------------------------------------------------
  // Warm Interior Stained-Glass Lights & Night Spire Floodlights (<= 6 total)
  // ------------------------------------------------------------------
  const interiorLights: THREE.PointLight[] = [];
  const lightPositions: [number, number, number][] = [
    [0, 7.6, -2.6],
    [0, 7.6, 3.6],
  ];
  for (const [lx, ly, lz] of lightPositions) {
    const pl = new THREE.PointLight(0xffa947, 0, 22, 1.5);
    pl.position.set(lx, ly, lz);
    root.add(pl);
    interiorLights.push(pl);
  }

  const nativityUplight = new THREE.PointLight(0xffb454, 0, 34, 1.35);
  nativityUplight.position.set(12.2, 16.5, 0);
  root.add(nativityUplight);

  const passionUplight = new THREE.PointLight(0xd4e2ff, 0, 34, 1.35);
  passionUplight.position.set(-12.2, 16.5, 0);
  root.add(passionUplight);

  const centralUplight = new THREE.PointLight(0xffcb78, 0, 44, 1.25);
  centralUplight.position.set(0, 31.0, 4.8);
  root.add(centralUplight);

  const spireUplights = {
    nativity: nativityUplight,
    passion: passionUplight,
    central: centralUplight,
  };

  // ------------------------------------------------------------------
  // Active Construction Cranes & Rising Scaffolding Collars
  // ------------------------------------------------------------------
  const nativityCrane = createTowerCrane(18, 8.5, mats.craneMast, mats.craneAccent, geometries);
  nativityCrane.group.position.set(11.4, 0, -5.8);
  nativityCrane.group.visible = false;
  root.add(nativityCrane.group);

  const passionCrane = createTowerCrane(20, 8.5, mats.craneMast, mats.craneAccent, geometries);
  passionCrane.group.position.set(-10.8, 0, -4.8);
  passionCrane.group.visible = false;
  root.add(passionCrane.group);

  const centralCrane = createTowerCrane(32, 11.5, mats.craneMast, mats.craneAccent, geometries);
  centralCrane.group.position.set(5.4, 0, -5.4);
  centralCrane.group.visible = false;
  root.add(centralCrane.group);

  const makeScaffoldRing = (w: number, d: number) => {
    const geo = new THREE.BoxGeometry(w, 0.45, d);
    geometries.push(geo);
    const mesh = new THREE.Mesh(geo, mats.scaffoldRing);
    mesh.visible = false;
    root.add(mesh);
    return mesh;
  };

  const scaffolds = {
    nativity: makeScaffoldRing(3.4, 7.6),
    passion: makeScaffoldRing(3.4, 7.6),
    nave: makeScaffoldRing(9.8, 17.0),
    central: makeScaffoldRing(6.8, 6.8),
  };
  scaffolds.nativity.position.set(7.45, 1, 0);
  scaffolds.passion.position.set(-7.45, 1, 0);
  scaffolds.nave.position.set(0, 1, 0.4);
  scaffolds.central.position.set(0, 1, 0);

  // ------------------------------------------------------------------
  // Atmospheric Particle Systems: Dusk/Night Light Rain & Drifting Mist
  // ------------------------------------------------------------------
  const RAIN_COUNT = 680;
  const rainDrops = createInitialRainDrops(RAIN_COUNT);
  const rainPositions = new Float32Array(RAIN_COUNT * 6);
  const rainGeo = new THREE.BufferGeometry();
  const rainPosAttr = new THREE.BufferAttribute(rainPositions, 3);
  rainPosAttr.setUsage(THREE.DynamicDrawUsage);
  rainGeo.setAttribute('position', rainPosAttr);
  geometries.push(rainGeo);

  const rainMat = new THREE.LineBasicMaterial({
    color: 0xc8defa,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  disposableMaterials.push(rainMat);
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  rainLines.frustumCulled = false;
  rainLines.visible = false;
  scene.add(rainLines);

  const FOG_COUNT = 110;
  const fogWisps = createInitialFogWisps(FOG_COUNT);
  const fogPositions = new Float32Array(FOG_COUNT * 3);
  const fogGeo = new THREE.BufferGeometry();
  const fogPosAttr = new THREE.BufferAttribute(fogPositions, 3);
  fogPosAttr.setUsage(THREE.DynamicDrawUsage);
  fogGeo.setAttribute('position', fogPosAttr);
  geometries.push(fogGeo);

  const mistTex = createSoftMistTexture();
  disposableTextures.push(mistTex);
  const fogWispMat = new THREE.PointsMaterial({
    color: 0xdce6f5,
    map: mistTex,
    size: 16.5,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  disposableMaterials.push(fogWispMat);
  const fogPoints = new THREE.Points(fogGeo, fogWispMat);
  fogPoints.frustumCulled = false;
  fogPoints.visible = false;
  scene.add(fogPoints);

  // ------------------------------------------------------------------
  // Bird Flocking Animations: 36 Articulated Swifts & Plaza Pigeons (3 InstancedMeshes)
  // ------------------------------------------------------------------
  const BIRD_COUNT = 36;
  const birds = createBirdFlock(BIRD_COUNT);

  const birdBodyGeo = new THREE.ConeGeometry(0.11, 0.56, 5);
  birdBodyGeo.rotateX(Math.PI / 2);
  const leftWingGeo = new THREE.BoxGeometry(0.58, 0.03, 0.22);
  leftWingGeo.translate(-0.29, 0, 0); // pivot cleanly at shoulder!
  const rightWingGeo = new THREE.BoxGeometry(0.58, 0.03, 0.22);
  rightWingGeo.translate(0.29, 0, 0);
  geometries.push(birdBodyGeo, leftWingGeo, rightWingGeo);

  const birdBodiesInst = new THREE.InstancedMesh(birdBodyGeo, mats.birdFeather, BIRD_COUNT);
  const birdLeftWingsInst = new THREE.InstancedMesh(leftWingGeo, mats.birdFeather, BIRD_COUNT);
  const birdRightWingsInst = new THREE.InstancedMesh(rightWingGeo, mats.birdFeather, BIRD_COUNT);
  birdBodiesInst.frustumCulled = false;
  birdLeftWingsInst.frustumCulled = false;
  birdRightWingsInst.frustumCulled = false;

  const birdColor = new THREE.Color();
  for (let i = 0; i < BIRD_COUNT; i++) {
    const shade = birds[i].flockGroup === 0 ? 0.2 + (i % 3) * 0.06 : 0.42 + (i % 4) * 0.08;
    birdColor.setRGB(shade, shade + 0.02, shade + 0.05);
    birdBodiesInst.setColorAt(i, birdColor);
    birdLeftWingsInst.setColorAt(i, birdColor);
    birdRightWingsInst.setColorAt(i, birdColor);
  }
  if (birdBodiesInst.instanceColor) birdBodiesInst.instanceColor.needsUpdate = true;
  if (birdLeftWingsInst.instanceColor) birdLeftWingsInst.instanceColor.needsUpdate = true;
  if (birdRightWingsInst.instanceColor) birdRightWingsInst.instanceColor.needsUpdate = true;

  scene.add(birdBodiesInst, birdLeftWingsInst, birdRightWingsInst);

  // ------------------------------------------------------------------
  // Progress Animation Controller (Piece-by-Piece Stacking)
  // ------------------------------------------------------------------
  const applyProgress = (
    p: PhaseProgressState,
    elapsedSec: number,
    atmos: AtmosphereState
  ) => {
    const setGroupActive = (group: THREE.Group, plane: THREE.Plane, prog: number) => {
      if (prog <= 0.002) {
        group.visible = false;
        plane.constant = -5;
      } else {
        group.visible = true;
        plane.constant = 200;
      }
    };

    setGroupActive(cryptGroup, mats.clipPlanes.crypt, p.crypt);
    setGroupActive(apseGroup, mats.clipPlanes.apse, p.apse);
    setGroupActive(nativityBodyGroup, mats.clipPlanes.nativityBody, p.nativityBody);
    setGroupActive(nativityTowersGroup, mats.clipPlanes.nativityTowers, p.nativityTowers);

    setGroupActive(passionBodyGroup, mats.clipPlanes.passionBody, p.passionBody);
    setGroupActive(passionTowersGroup, mats.clipPlanes.passionTowers, p.passionTowers);

    setGroupActive(naveWallsGroup, mats.clipPlanes.naveWalls, p.naveWalls);
    setGroupActive(naveVaultsGroup, mats.clipPlanes.naveVaults, p.naveVaults);

    setGroupActive(evangelistTowersGroup, mats.clipPlanes.evangelistTowers, p.evangelistTowers);
    setGroupActive(virginMaryTowerGroup, mats.clipPlanes.virginMaryTower, p.virginMaryTower);
    setGroupActive(jesusTowerGroup, mats.clipPlanes.jesusTower, p.jesusTower);
    setGroupActive(gloryFacadeGroup, mats.clipPlanes.gloryFacade, p.gloryFacade);

    for (let i = 0; i < stackParts.length; i++) {
      const part = stackParts[i];
      const prog = p[part.phase];
      const tf = computeStackTransform(prog, part.start, part.end, part.dropHeight, part.mode);
      if (!tf.visible) {
        part.obj.visible = false;
      } else {
        part.obj.visible = true;
        const growShift =
          part.mode === 'growY' ? -(1 - tf.scaleY) * part.halfHeight : 0;
        part.obj.position.y = part.baseY + tf.offsetY + growShift;
        part.obj.scale.set(
          part.baseScaleX * tf.scaleXY,
          part.baseScaleY * tf.scaleY,
          part.baseScaleZ * tf.scaleXY
        );
      }
    }

    const glow = p.stainedGlassGlow;
    const nightSpire = atmos.spireGlowIntensity;
    mats.stainedGlass.emissiveIntensity = 0.16 + glow * (2.15 + atmos.windowGlowBoost);
    for (const pl of interiorLights) {
      pl.intensity = glow * (12.0 + atmos.uplightIntensity * 14.0);
    }

    const starGlow = THREE.MathUtils.smoothstep(p.virginMaryTower, 0.88, 1.0);
    mats.starVirginMary.emissiveIntensity = 0.3 + starGlow * (2.2 + nightSpire * 1.5);
    starLight.intensity = starGlow * (12 + atmos.uplightIntensity * 18);
    starMesh.rotation.y = elapsedSec * 0.25;

    // Illuminated finials, trencadís glazes, tower louvers & four-armed cross at dusk/night
    mats.finialNativityGold.emissiveIntensity = nightSpire * 1.15;
    mats.finialWhiteCeramic.emissiveIntensity = nightSpire * 0.65;
    mats.trencadisNativity.emissiveIntensity = nightSpire * 0.55;
    mats.trencadisVirginMary.emissiveIntensity = nightSpire * 0.62;
    mats.finialPassion.emissiveIntensity = nightSpire * 0.72;
    mats.finialEvangelists.emissiveIntensity = nightSpire * 1.1;
    mats.crossJesusTower.emissiveIntensity = 0.55 + nightSpire * 1.85;

    mats.shadowRecessApse.emissiveIntensity = p.apse * nightSpire * 0.7;
    mats.shadowRecessNativity.emissiveIntensity = p.nativityTowers * nightSpire * 0.85;
    mats.shadowRecessPassion.emissiveIntensity = p.passionTowers * nightSpire * 0.65;
    mats.shadowRecessNave.emissiveIntensity = glow * nightSpire * 0.6;
    mats.shadowRecessEvan.emissiveIntensity = p.evangelistTowers * nightSpire * 0.92;
    mats.shadowRecessMary.emissiveIntensity = p.virginMaryTower * nightSpire * 0.96;
    mats.shadowRecessJesus.emissiveIntensity = p.jesusTower * nightSpire * 1.05;
    mats.shadowRecessGlory.emissiveIntensity = p.gloryFacade * nightSpire * 0.85;

    mats.eixampleBuilding.emissiveIntensity = atmos.eixampleWindowGlow * 1.05;
    mats.lampGlow.emissiveIntensity = 0.12 + (atmos.duskFactor * 0.85 + atmos.nightFactor * 1.85);

    spireUplights.nativity.intensity =
      Math.max(p.nativityBody * 0.6, p.nativityTowers) * atmos.uplightIntensity * 26;
    spireUplights.passion.intensity =
      Math.max(p.passionBody * 0.6, p.passionTowers) * atmos.uplightIntensity * 22;
    spireUplights.central.intensity =
      Math.max(p.evangelistTowers, p.jesusTower) * atmos.uplightIntensity * 34;

    const natActive = p.nativityTowers > 0.02 && p.nativityTowers < 0.985;
    const apseOrNatActive =
      (p.apse > 0.05 && p.apse < 0.985) ||
      (p.nativityBody > 0.05 && p.nativityBody < 0.985) ||
      natActive;
    nativityCrane.group.visible = apseOrNatActive;
    if (apseOrNatActive) {
      nativityCrane.group.scale.y = 0.45 + p.nativityTowers * 0.9;
      nativityCrane.jib.rotation.y = Math.sin(elapsedSec * 0.45) * 0.85 - 0.6;
    }
    scaffolds.nativity.visible = natActive;
    if (natActive) {
      scaffolds.nativity.position.y = THREE.MathUtils.lerp(1.5, 27.5, p.nativityTowers);
    }

    const passActive =
      (p.passionBody > 0.03 && p.passionBody < 0.985) ||
      (p.passionTowers > 0.02 && p.passionTowers < 0.985);
    passionCrane.group.visible = passActive;
    if (passActive) {
      passionCrane.group.scale.y = 0.45 + p.passionTowers * 0.95;
      passionCrane.jib.rotation.y = Math.cos(elapsedSec * 0.4) * 0.8 + 0.8;
    }
    scaffolds.passion.visible = p.passionTowers > 0.02 && p.passionTowers < 0.985;
    if (scaffolds.passion.visible) {
      scaffolds.passion.position.y = THREE.MathUtils.lerp(1.5, 29.0, p.passionTowers);
    }

    const naveActive = p.naveWalls > 0.03 && p.naveVaults < 0.985;
    scaffolds.nave.visible = naveActive;
    if (naveActive) {
      const naveMix = p.naveWalls * 0.65 + p.naveVaults * 0.35;
      scaffolds.nave.position.y = THREE.MathUtils.lerp(1.5, 13.8, naveMix);
    }

    const centralActive =
      (p.evangelistTowers > 0.02 && p.evangelistTowers < 0.985) ||
      (p.jesusTower > 0.02 && p.jesusTower < 0.985) ||
      (p.gloryFacade > 0.02 && p.gloryFacade < 0.985);
    centralCrane.group.visible = centralActive;
    if (centralActive) {
      centralCrane.group.scale.y = 0.6 + p.jesusTower * 0.78;
      centralCrane.jib.rotation.y = elapsedSec * 0.35;
    }
    scaffolds.central.visible = p.jesusTower > 0.05 && p.jesusTower < 0.985;
    if (scaffolds.central.visible) {
      scaffolds.central.position.y = THREE.MathUtils.lerp(11.0, 42.5, p.jesusTower);
    }
  };

  // ------------------------------------------------------------------
  // Living Scene Controller: Rain, Drifting Fog & Articulated Bird Flocks
  // ------------------------------------------------------------------
  const applyLivingScene = (
    dt: number,
    elapsedSec: number,
    atmos: AtmosphereState,
    weatherMode: WeatherMode,
    birdsEnabled: boolean
  ) => {
    const weather = computeWeatherAtmosphere(atmos.timeOfDay, weatherMode);

    // 1. Light rain diagonal streaks
    if (weather.rainOpacity > 0.01) {
      rainLines.visible = true;
      rainMat.opacity = weather.rainOpacity;
      rainMat.color.setHex(atmos.nightFactor > 0.4 ? 0x8db0df : 0xffe0bc);

      if (dt > 0) {
        stepRainDrops(rainDrops, dt, weather.windX, weather.windZ, weather.rainSpeed);
      }

      const activeDrops = Math.max(1, Math.round(RAIN_COUNT * weather.rainDensity));
      rainGeo.setDrawRange(0, activeDrops * 2);
      const slantX = (weather.windX / weather.rainSpeed) * 1.1;
      const slantZ = (weather.windZ / weather.rainSpeed) * 1.1;

      for (let i = 0; i < activeDrops; i++) {
        const d = rainDrops[i];
        const idx = i * 6;
        rainPositions[idx] = d.x;
        rainPositions[idx + 1] = d.y;
        rainPositions[idx + 2] = d.z;
        rainPositions[idx + 3] = d.x - slantX * d.length;
        rainPositions[idx + 4] = d.y + d.length;
        rainPositions[idx + 5] = d.z - slantZ * d.length;
      }
      rainPosAttr.needsUpdate = true;
    } else {
      rainLines.visible = false;
    }

    // 2. Drifting atmospheric fog wisps
    if (weather.fogWispOpacity > 0.01) {
      fogPoints.visible = true;
      fogWispMat.opacity = weather.fogWispOpacity;
      fogWispMat.color.setHex(atmos.nightFactor > 0.4 ? 0x9eb8de : 0xf4d8b8);

      if (dt > 0) {
        stepFogWisps(fogWisps, dt, elapsedSec, weather.windX, weather.windZ);
      }
      for (let i = 0; i < FOG_COUNT; i++) {
        const w = fogWisps[i];
        const idx = i * 3;
        fogPositions[idx] = w.x;
        fogPositions[idx + 1] = w.y + Math.sin(elapsedSec * 0.4 + w.phase) * 0.45;
        fogPositions[idx + 2] = w.z;
      }
      fogPosAttr.needsUpdate = true;
    } else {
      fogPoints.visible = false;
    }

    // 3. Articulated bird flocking
    birdBodiesInst.visible = birdsEnabled;
    birdLeftWingsInst.visible = birdsEnabled;
    birdRightWingsInst.visible = birdsEnabled;

    if (birdsEnabled) {
      if (dt > 0) {
        stepBirdFlock(birds, dt, elapsedSec);
      }
      for (let i = 0; i < BIRD_COUNT; i++) {
        const b = birds[i];
        _birdDir.set(b.vx, b.vy, b.vz).normalize();
        const yaw = Math.atan2(_birdDir.x, _birdDir.z);
        const pitch = -Math.asin(THREE.MathUtils.clamp(_birdDir.y, -0.8, 0.8));

        _birdDummy.position.set(b.x, b.y, b.z);
        _birdDummy.rotation.set(pitch, yaw, b.bankAngle, 'YXZ');
        _birdDummy.scale.setScalar(b.scale);
        _birdDummy.updateMatrix();
        birdBodiesInst.setMatrixAt(i, _birdDummy.matrix);

        const flap = computeWingFlapAngle(b.wingPhase, b.vy);
        _birdRight.copy(_birdDir).cross(_birdUp).normalize();

        _wingLeftDummy.position.set(b.x, b.y, b.z);
        _wingLeftDummy.rotation.set(pitch, yaw, b.bankAngle + flap, 'YXZ');
        _wingLeftDummy.scale.setScalar(b.scale);
        _wingLeftDummy.updateMatrix();
        birdLeftWingsInst.setMatrixAt(i, _wingLeftDummy.matrix);

        _wingRightDummy.position.set(b.x, b.y, b.z);
        _wingRightDummy.rotation.set(pitch, yaw, b.bankAngle - flap, 'YXZ');
        _wingRightDummy.scale.setScalar(b.scale);
        _wingRightDummy.updateMatrix();
        birdRightWingsInst.setMatrixAt(i, _wingRightDummy.matrix);
      }
      birdBodiesInst.instanceMatrix.needsUpdate = true;
      birdLeftWingsInst.instanceMatrix.needsUpdate = true;
      birdRightWingsInst.instanceMatrix.needsUpdate = true;
    }

    return {
      rainOpacity: weather.rainOpacity,
      fogWispOpacity: weather.fogWispOpacity,
    };
  };

  // ------------------------------------------------------------------
  // Interactive Focus Mode Raycast Hitboxes & Architectural Highlight Rings
  // ------------------------------------------------------------------
  const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
  disposableMaterials.push(hitboxMat);

  const ringGeo = new THREE.TorusGeometry(0.95, 0.06, 8, 24);
  geometries.push(ringGeo);

  const hitboxMeshes: THREE.Mesh[] = [];
  const focusRings = new Map<
    string,
    { ring: THREE.Mesh; mat: THREE.MeshBasicMaterial; revealYear: number }
  >();

  ARCHITECTURAL_FEATURES.forEach((feat) => {
    const hitGeo = new THREE.SphereGeometry(feat.hitRadius, 10, 8);
    geometries.push(hitGeo);
    const hitMesh = new THREE.Mesh(hitGeo, hitboxMat);
    hitMesh.position.set(...feat.anchorPosition);
    hitMesh.userData.featureId = feat.id;
    hitMesh.userData.revealYear = feat.revealYear;
    hitMesh.layers.set(1);
    scene.add(hitMesh);
    hitboxMeshes.push(hitMesh);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xe0a458,
      transparent: true,
      opacity: 0,
      depthTest: false,
    });
    disposableMaterials.push(ringMat);
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(...feat.anchorPosition);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.visible = false;
    ringMesh.renderOrder = 10;
    scene.add(ringMesh);
    focusRings.set(feat.id, { ring: ringMesh, mat: ringMat, revealYear: feat.revealYear });
  });

  const setFocusHighlight = (
    selectedId: string | null,
    hoveredId: string | null,
    focusMode: boolean,
    year: number
  ) => {
    focusRings.forEach((entry, id) => {
      const isSelected = id === selectedId;
      const isHovered = id === hoveredId;
      const isBuilt = year >= entry.revealYear - 2;
      if (isSelected) {
        entry.ring.visible = true;
        entry.mat.color.setHex(0xf6cf92);
        entry.mat.opacity = 0.92;
        entry.ring.scale.setScalar(1.35);
      } else if (isHovered && isBuilt) {
        entry.ring.visible = true;
        entry.mat.color.setHex(0xfff1d6);
        entry.mat.opacity = 0.8;
        entry.ring.scale.setScalar(1.15);
      } else if (focusMode && isBuilt) {
        entry.ring.visible = true;
        entry.mat.color.setHex(0xe0a458);
        entry.mat.opacity = 0.42;
        entry.ring.scale.setScalar(0.95);
      } else {
        entry.ring.visible = false;
      }
    });
  };

  // Precompute tangent vectors on all indexed procedural geometries for normal-mapped masonry relief
  for (let i = 0; i < geometries.length; i++) {
    const geo = geometries[i];
    if (
      geo.index &&
      geo.attributes.position &&
      geo.attributes.normal &&
      geo.attributes.uv &&
      !geo.attributes.tangent
    ) {
      geo.computeTangents();
    }
  }

  return {
    root,
    groups: {
      crypt: cryptGroup,
      apse: apseGroup,
      nativityBody: nativityBodyGroup,
      nativityTowers: nativityTowersGroup,
      passionBody: passionBodyGroup,
      passionTowers: passionTowersGroup,
      naveWalls: naveWallsGroup,
      naveVaults: naveVaultsGroup,
      evangelistTowers: evangelistTowersGroup,
      virginMaryTower: virginMaryTowerGroup,
      jesusTower: jesusTowerGroup,
      gloryFacade: gloryFacadeGroup,
    },
    cranes: {
      nativity: { ...nativityCrane, baseHeight: 18 },
      passion: { ...passionCrane, baseHeight: 20 },
      central: { ...centralCrane, baseHeight: 32 },
    },
    scaffolds,
    interiorLights,
    spireUplights,
    starLight,
    starMesh,
    hitboxMeshes,
    setFocusHighlight,
    applyProgress,
    applyLivingScene,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      disposableMaterials.forEach((m) => m.dispose());
      disposableTextures.forEach((t) => t.dispose());
    },
  };
}
