import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Fine architectural detail for close-up viewing: tower inscriptions, louvre slats,
 * pinnacle fruit, apostle statues, façade sculpture and plaza life. Scene units are
 * about 4 m, so a 1.7 m visitor is roughly 0.42 units tall.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Converts a primitive to a non-indexed geometry with position, normal and uv, so parts merge. */
function solid(geometry: THREE.BufferGeometry) {
  const result = geometry.index ? geometry.toNonIndexed() : geometry;
  if (!result.attributes.uv) {
    result.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(result.attributes.position.count * 2), 2));
  }
  if (result !== geometry) geometry.dispose();
  return result;
}

function merge(parts: THREE.BufferGeometry[]) {
  const merged = mergeGeometries(parts.map(solid))!;
  parts.forEach((part) => part.dispose());
  return merged;
}

/** Orients a geometry so its local +z faces outward at angle `a` around the tower axis. */
function faceOutward(geometry: THREE.BufferGeometry, a: number, radius: number, y: number) {
  return geometry.rotateY(Math.PI / 2 - a).translate(Math.cos(a) * radius, y, Math.sin(a) * radius);
}

export interface TowerProfile {
  shaftHeight: number;
  baseRadius: number;
  topRadius: number;
  /** Height of the shaft's base above the tower origin. */
  shaftBase: number;
}

/** Radius of the masonry drum at a fraction of the shaft height. */
export function drumRadius(profile: TowerProfile, frac: number) {
  return THREE.MathUtils.lerp(profile.baseRadius * 0.94, profile.topRadius * 0.92, Math.pow(frac, 0.72));
}

/**
 * The words “Sanctus, Sanctus, Sanctus” spiral up Gaudí’s bell towers in raised letters.
 * Returns geometry centred vertically (for growY stacking) and its half height.
 */
export function towerInscription(profile: TowerProfile, seed: number, turns = 2.3) {
  const random = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];
  const start = 0.2;
  const end = 0.86;
  const letters = 150;
  for (let i = 0; i < letters; i++) {
    // A gap after every seven letters spaces out the words.
    if (i % 8 === 7) continue;
    const t = i / letters;
    const frac = start + (end - start) * t;
    const angle = t * turns * Math.PI * 2 + seed;
    const radius = drumRadius(profile, frac) + 0.035;
    const width = 0.09 + random() * 0.08;
    const letter = new THREE.BoxGeometry(width, 0.24, 0.06);
    parts.push(faceOutward(letter, angle, radius, profile.shaftBase + frac * profile.shaftHeight));
  }
  const geometry = merge(parts);
  const low = profile.shaftBase + start * profile.shaftHeight;
  const high = profile.shaftBase + end * profile.shaftHeight;
  geometry.translate(0, -(low + high) / 2, 0);
  return { geometry, centre: (low + high) / 2, halfHeight: (high - low) / 2 };
}

/** Angled stone louvre slats that fill a perforated band, deflecting bell sound downward. */
export function louvreRing(radius: number, count: number) {
  const parts: THREE.BufferGeometry[] = [];
  const width = (2 * Math.PI * radius / count) * 0.82;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    for (const y of [-0.07, 0.07]) {
      const slat = new THREE.BoxGeometry(width, 0.035, 0.22).rotateX(0.62);
      parts.push(faceOutward(slat, a, radius + 0.04, y));
    }
  }
  return merge(parts);
}

/** Clusters of ceramic “fruit” spheres around a pinnacle orb. */
export function pinnacleFruit(radius: number, seed: number) {
  const random = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) {
    const a = random() * Math.PI * 2;
    const b = (random() - 0.5) * Math.PI * 0.8;
    const r = radius * (1.05 + random() * 0.15);
    const size = radius * (0.12 + random() * 0.1);
    parts.push(new THREE.IcosahedronGeometry(size, 1).translate(Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r, Math.sin(a) * Math.cos(b) * r));
  }
  return merge(parts);
}

/** A seated apostle on a ledge, facing local +x. About 1 unit (4 m) tall. */
export function seatedApostle(seed: number) {
  const random = mulberry32(seed);
  const tilt = (random() - 0.5) * 0.3;
  return merge([
    new THREE.BoxGeometry(0.62, 0.1, 0.78).translate(0.24, 0.05, 0),
    new THREE.BoxGeometry(0.3, 0.36, 0.42).translate(0.1, 0.28, 0),
    new THREE.BoxGeometry(0.34, 0.13, 0.28).translate(0.3, 0.38, 0),
    new THREE.BoxGeometry(0.1, 0.32, 0.26).translate(0.45, 0.2, 0),
    new THREE.CylinderGeometry(0.11, 0.17, 0.46, 9).rotateZ(tilt).translate(0.16, 0.66, 0),
    new THREE.SphereGeometry(0.085, 10, 8).translate(0.18 + tilt * 0.2, 0.97, 0),
    new THREE.BoxGeometry(0.05, 0.22, 0.16).translate(0.3, 0.62, 0.1 * (random() < 0.5 ? 1 : -1)),
    new THREE.CylinderGeometry(0.02, 0.02, 0.6, 5).rotateZ(-0.25).translate(0.32, 0.72, -0.13),
  ]);
}

interface ReliefOptions {
  /** Plane of the façade front, as x position and outward sign. */
  x: number;
  outward: 1 | -1;
  z: [number, number];
  y: [number, number];
  count: number;
  seed: number;
  material: THREE.Material;
  /** Rectangles (z, y) to keep clear, such as doorways. */
  avoid?: { z: [number, number]; y: [number, number] }[];
  /** Extra density along these (z, y) lines, such as gable edges. */
  attract?: { from: [number, number]; to: [number, number] }[];
}

function sampleRelief(options: ReliefOptions, random: () => number) {
  for (let tries = 0; tries < 40; tries++) {
    let z: number;
    let y: number;
    if (options.attract?.length && random() < 0.55) {
      const line = options.attract[Math.floor(random() * options.attract.length)];
      const t = random();
      z = THREE.MathUtils.lerp(line.from[0], line.to[0], t) + (random() - 0.5) * 0.5;
      y = THREE.MathUtils.lerp(line.from[1], line.to[1], t) + (random() - 0.5) * 0.5;
    } else {
      z = THREE.MathUtils.lerp(options.z[0], options.z[1], random());
      y = THREE.MathUtils.lerp(options.y[0], options.y[1], random() ** 0.8);
    }
    const blocked = options.avoid?.some((r) => z > r.z[0] && z < r.z[1] && y > r.y[0] && y < r.y[1]);
    if (!blocked) return { z, y };
  }
  return null;
}

/**
 * Organic Nativity-style sculpture: clustered stone foliage, figures and blossoms,
 * as one instanced mesh hugging the façade.
 */
export function organicRelief(options: ReliefOptions) {
  const random = mulberry32(options.seed);
  const geometry = new THREE.SphereGeometry(1, 7, 5);
  const mesh = new THREE.InstancedMesh(geometry, options.material, options.count);
  const dummy = new THREE.Object3D();
  let placed = 0;
  for (let i = 0; i < options.count; i++) {
    const spot = sampleRelief(options, random);
    if (!spot) continue;
    // Small, shallow carvings pressed into the wall: leaves, blossoms and figures in relief.
    const size = 0.04 + random() ** 2 * 0.12;
    // Half-buried in the wall so each reads as a carved boss rather than a loose stone.
    dummy.position.set(options.x + options.outward * random() * 0.03, spot.y, spot.z);
    dummy.rotation.set(0, 0, random() * 6);
    dummy.scale.set(size * (0.35 + random() * 0.25), size * (0.8 + random() * 0.9), size * (0.7 + random() * 0.6));
    dummy.updateMatrix();
    mesh.setMatrixAt(placed++, dummy.matrix);
  }
  mesh.count = placed;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/** Angular Passion-style sculpture: faceted, gaunt figures in hard-edged planes. */
export function angularRelief(options: ReliefOptions) {
  const random = mulberry32(options.seed);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(geometry, options.material, options.count);
  const dummy = new THREE.Object3D();
  let placed = 0;
  for (let i = 0; i < options.count; i++) {
    const spot = sampleRelief(options, random);
    if (!spot) continue;
    const size = 0.1 + random() * 0.16;
    dummy.position.set(options.x + options.outward * (0.02 + random() * 0.08), spot.y, spot.z);
    dummy.rotation.set((random() - 0.5) * 0.25, (random() - 0.5) * 0.5, (random() - 0.5) * 0.3);
    // Upright, gaunt and hard-edged, like the façade’s elongated figures.
    dummy.scale.set(size * 0.35, size * (2.2 + random() * 1.6), size * (0.45 + random() * 0.3));
    dummy.updateMatrix();
    mesh.setMatrixAt(placed++, dummy.matrix);
  }
  mesh.count = placed;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/** Stone stalactite drips hanging beneath a ledge, between z0 and z1. */
export function stalactites(x: number, y: number, z0: number, z1: number, count: number, seed: number) {
  const random = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const length = 0.18 + random() * 0.5;
    const cone = new THREE.ConeGeometry(0.035 + random() * 0.03, length, 5).rotateX(Math.PI);
    parts.push(cone.translate(x + (random() - 0.5) * 0.25, y - length / 2, THREE.MathUtils.lerp(z0, z1, (i + random() * 0.6) / count)));
  }
  return merge(parts);
}

/** A small Nativity group — Mary, Joseph and the Child — for the central portal, facing +x. */
export function nativityGroup() {
  const figure = (z: number, height: number, lean: number) => [
    new THREE.CylinderGeometry(0.07, 0.13, height * 0.78, 8).rotateX(lean).translate(0, height * 0.39, z),
    new THREE.SphereGeometry(0.065, 8, 6).translate(0, height * 0.84, z + lean * 0.2),
  ];
  return merge([
    new THREE.BoxGeometry(0.5, 0.12, 1.3).translate(0, 0.06, 0),
    ...figure(-0.3, 0.62, 0.15),
    ...figure(0.32, 0.7, -0.1),
    new THREE.BoxGeometry(0.2, 0.1, 0.26).translate(0.04, 0.17, 0),
    new THREE.SphereGeometry(0.05, 8, 6).translate(0.04, 0.26, 0),
  ]);
}

/** White doves circling the Tree of Life, as one mesh. */
export function doves(centre: THREE.Vector3, count: number, seed: number) {
  const random = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + random() * 0.4;
    const r = 0.6 + random() * 0.7;
    const y = centre.y + (random() - 0.3) * 1.6;
    const body = new THREE.SphereGeometry(0.05, 6, 4).scale(1.6, 0.8, 0.8);
    const wings = new THREE.BoxGeometry(0.03, 0.01, 0.28).rotateX((random() - 0.5) * 0.6);
    for (const part of [body, wings]) parts.push(part.rotateY(-a).translate(centre.x + Math.cos(a) * r, y, centre.z + Math.sin(a) * r));
  }
  return merge(parts);
}

// ─── Plaza life ─────────────────────────────────────────────────────────────

interface StreetLifeOptions {
  /** Areas that pedestrians avoid, as axis-aligned rectangles in x/z. */
  avoid: { x: [number, number]; z: [number, number] }[];
  plazaHalf: number;
  plazaChamfer: number;
  streetLines: number[];
  extent: number;
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
}

/**
 * Visitors on the plaza, benches by the pool and cars along the Eixample streets.
 * Everything is instanced and static, so it adds scale and life at no animation cost.
 */
export function streetLife(parent: THREE.Group, options: StreetLifeOptions) {
  const random = mulberry32(1882);
  const dummy = new THREE.Object3D();

  const blocked = (x: number, z: number) =>
    options.avoid.some((r) => x > r.x[0] && x < r.x[1] && z > r.z[0] && z < r.z[1]) ||
    Math.abs(x) + Math.abs(z) > options.plazaHalf * 2 - options.plazaChamfer - 0.6 ||
    Math.abs(x) > options.plazaHalf - 0.6 || Math.abs(z) > options.plazaHalf - 0.6;

  // Visitors: a body and a head, in a spread of clothing colours.
  const person = merge([
    new THREE.CylinderGeometry(0.055, 0.075, 0.32, 6).translate(0, 0.16, 0),
    new THREE.CylinderGeometry(0.06, 0.05, 0.12, 6).translate(0, 0.38, 0),
    new THREE.SphereGeometry(0.045, 6, 5).translate(0, 0.47, 0),
  ]);
  const clothing = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  const spots: [number, number][] = [];
  // Crowds gather at the Glory steps, the Nativity pool and the Passion side.
  const crowds: [number, number, number, number][] = [[0, 18.5, 7, 220], [13, 9, 4, 90], [13, -10, 4, 70], [-14, 0, 6, 120], [0, -17, 6, 80]];
  for (const [cx, cz, spread, count] of crowds) {
    for (let i = 0; i < count; i++) {
      const x = cx + (random() + random() - 1) * spread;
      const z = cz + (random() + random() - 1) * spread;
      if (!blocked(x, z)) spots.push([x, z]);
    }
  }
  const people = new THREE.InstancedMesh(person, clothing, spots.length);
  const palette = [0x2d3a4f, 0xc8423b, 0xe9e4d8, 0x3f6d4e, 0x1f1f22, 0xd9a441, 0x6b8bb8, 0x8c5a3c, 0xf2f0ea, 0x9a4d7a];
  spots.forEach(([x, z], i) => {
    dummy.position.set(x, 0.02, z);
    dummy.rotation.set(0, random() * 6, 0);
    dummy.scale.setScalar(0.88 + random() * 0.24);
    dummy.updateMatrix();
    people.setMatrixAt(i, dummy.matrix);
    people.setColorAt(i, new THREE.Color(palette[Math.floor(random() * palette.length)]));
  });
  people.castShadow = true;
  people.computeBoundingSphere();
  parent.add(people);

  // Benches along both long sides of the reflecting pool and the plaza edges.
  const bench = merge([
    new THREE.BoxGeometry(0.9, 0.05, 0.22).translate(0, 0.2, 0),
    new THREE.BoxGeometry(0.9, 0.18, 0.04).translate(0, 0.32, -0.1),
    new THREE.BoxGeometry(0.05, 0.2, 0.2).translate(-0.38, 0.1, 0),
    new THREE.BoxGeometry(0.05, 0.2, 0.2).translate(0.38, 0.1, 0),
  ]);
  const benchSpots: [number, number, number][] = [];
  for (let z = -6.5; z <= 6.5; z += 1.6) {
    benchSpots.push([13.7, z, Math.PI / 2], [22.7, z, -Math.PI / 2]);
  }
  for (let x = -18; x <= 18; x += 3) if (Math.abs(x) > 4) benchSpots.push([x, 22.6, Math.PI]);
  const benchMesh = new THREE.InstancedMesh(bench, new THREE.MeshStandardMaterial({ color: 0x6b5139, roughness: 0.8 }), benchSpots.length);
  benchSpots.forEach(([x, z, r], i) => {
    dummy.position.set(x, 0.02, z);
    dummy.rotation.set(0, r, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    benchMesh.setMatrixAt(i, dummy.matrix);
  });
  benchMesh.castShadow = true;
  benchMesh.computeBoundingSphere();
  parent.add(benchMesh);

  // Cars: parked along both kerbs and moving in the lanes of each Eixample street.
  const car = merge([
    new THREE.BoxGeometry(1.1, 0.22, 0.46).translate(0, 0.17, 0),
    new THREE.BoxGeometry(0.62, 0.18, 0.42).translate(-0.05, 0.36, 0),
  ]);
  const carSpots: [number, number, number][] = [];
  for (const line of options.streetLines) {
    for (const axis of [0, 1]) {
      for (const offset of [-2.55, -1.1, 1.1, 2.55]) {
        const parked = Math.abs(offset) > 2;
        for (let s = -options.extent; s < options.extent; s += parked ? 1.35 : 4 + random() * 6) {
          if (parked && random() < 0.18) continue;
          // Leave junctions and the plaza clear.
          if (options.streetLines.some((other) => Math.abs(s - other) < 3.6)) continue;
          if (Math.abs(s) < options.plazaHalf + 2 && Math.abs(line) < options.plazaHalf + 2) continue;
          const along = s + random() * 0.2;
          const x = axis === 0 ? line + offset : along;
          const z = axis === 0 ? along : line + offset;
          const heading = (axis === 0 ? Math.PI / 2 : 0) + (offset > 0 ? Math.PI : 0);
          carSpots.push([x, z, heading]);
        }
      }
    }
  }
  const cars = new THREE.InstancedMesh(car, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.45 }), carSpots.length);
  const paints = [0xf4f4f2, 0x1c1d20, 0xb9bec2, 0x8a1f1f, 0x2b4a7a, 0xe0c341, 0x1f1f1f];
  carSpots.forEach(([x, z, heading], i) => {
    dummy.position.set(x, -0.52, z);
    dummy.rotation.set(0, heading, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    cars.setMatrixAt(i, dummy.matrix);
    // Barcelona taxis are black and yellow; roughly one car in six.
    cars.setColorAt(i, new THREE.Color(random() < 0.16 ? 0xe0c341 : paints[Math.floor(random() * paints.length)]));
  });
  cars.castShadow = true;
  cars.receiveShadow = true;
  cars.computeBoundingSphere();
  parent.add(cars);

  options.geometries.push(person, bench, car);
  options.materials.push(clothing, benchMesh.material as THREE.Material, cars.material as THREE.Material);
}

/** Chimneys, water tanks and terrace pergolas on the Eixample block roofs. */
export function eixampleRooftops(parent: THREE.Group, blocks: readonly [number, number, number][], geometries: THREE.BufferGeometry[], materials: THREE.Material[]) {
  const random = mulberry32(1859);
  const chimney = merge([new THREE.BoxGeometry(0.28, 0.6, 0.28).translate(0, 0.3, 0), new THREE.BoxGeometry(0.36, 0.08, 0.36).translate(0, 0.62, 0)]);
  const tank = merge([new THREE.CylinderGeometry(0.22, 0.22, 0.42, 10).translate(0, 0.36, 0), new THREE.BoxGeometry(0.4, 0.15, 0.4).translate(0, 0.075, 0)]);
  const pergola = merge([
    ...[[-0.6, -0.4], [0.6, -0.4], [-0.6, 0.4], [0.6, 0.4]].map(([x, z]) => new THREE.BoxGeometry(0.05, 0.5, 0.05).translate(x, 0.25, z)),
    ...[-0.3, 0, 0.3].map((z) => new THREE.BoxGeometry(1.3, 0.04, 0.06).translate(0, 0.52, z)),
  ]);
  const kinds = [
    { geometry: chimney, material: new THREE.MeshStandardMaterial({ color: 0xb98a6a, roughness: 0.9 }), count: 12 },
    { geometry: tank, material: new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.6, metalness: 0.3 }), count: 4 },
    { geometry: pergola, material: new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 0.85 }), count: 3 },
  ];
  const dummy = new THREE.Object3D();
  for (const kind of kinds) {
    const mesh = new THREE.InstancedMesh(kind.geometry, kind.material, blocks.length * kind.count);
    let i = 0;
    for (const [bx, bh, bz] of blocks) {
      for (let k = 0; k < kind.count; k++) {
        // Keep to the ring of roof between the street front and the central courtyard.
        const side = Math.floor(random() * 4);
        const along = (random() - 0.5) * 18;
        const depth = 4.8 + random() * 5.2;
        const x = side < 2 ? along : (side === 2 ? depth : -depth);
        const z = side < 2 ? (side === 0 ? depth : -depth) : along;
        dummy.position.set(bx + x, -0.32 + bh + 0.28, bz + z);
        dummy.rotation.set(0, side < 2 ? 0 : Math.PI / 2, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
    }
    mesh.castShadow = true;
    mesh.computeBoundingSphere();
    parent.add(mesh);
    geometries.push(kind.geometry);
    materials.push(kind.material);
  }
}
