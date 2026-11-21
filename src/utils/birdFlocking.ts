export interface BirdAgent {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  orbitRadius: number;
  baseHeight: number;
  orbitDir: number;
  wingPhase: number;
  wingSpeed: number;
  bankAngle: number;
  scale: number;
  flockGroup: 0 | 1;
}

export function createBirdFlock(count = 36): BirdAgent[] {
  const birds: BirdAgent[] = [];
  for (let i = 0; i < count; i++) {
    const flockGroup: 0 | 1 = i < Math.floor(count * 0.65) ? 0 : 1;
    // Group 0: High swifts soaring around spires; Group 1: Lower plaza pigeons
    const clusterPhase = flockGroup === 0 ? 0.35 : 3.45;
    const spread = ((i % 9) - 4) * 0.14;
    const angle = clusterPhase + spread + (i * 0.09);

    const orbitRadius =
      flockGroup === 0
        ? 15.5 + ((i * 13) % 15)
        : 17.0 + ((i * 17) % 11);
    const baseHeight =
      flockGroup === 0
        ? 23.0 + ((i * 7) % 19)
        : 7.5 + ((i * 5) % 8);
    const orbitDir = flockGroup === 0 ? 1 : -1;
    const speed = flockGroup === 0 ? 8.2 + (i % 4) * 0.55 : 6.4 + (i % 3) * 0.5;

    const x = Math.cos(angle) * orbitRadius;
    const z = Math.sin(angle) * orbitRadius;
    // Tangent velocity
    const vx = -Math.sin(angle) * speed * orbitDir;
    const vz = Math.cos(angle) * speed * orbitDir;

    birds.push({
      x,
      y: baseHeight,
      z,
      vx,
      vy: 0,
      vz,
      orbitRadius,
      baseHeight,
      orbitDir,
      wingPhase: i * 0.85,
      wingSpeed: flockGroup === 0 ? 9.5 + (i % 5) * 0.8 : 11.2 + (i % 4) * 0.7,
      bankAngle: orbitDir * 0.25,
      scale: flockGroup === 0 ? 0.85 + (i % 4) * 0.08 : 0.72 + (i % 3) * 0.07,
      flockGroup,
    });
  }
  return birds;
}

/**
 * Steps boids flocking around La Sagrada Família with cohesion, separation,
 * alignment, radial spire avoidance, and altitude soaring waves.
 */
export function stepBirdFlock(birds: BirdAgent[], dt: number, elapsed: number): void {
  const n = birds.length;
  const safeDt = Math.min(0.05, Math.max(0.001, dt));

  for (let i = 0; i < n; i++) {
    const b = birds[i];

    let sepX = 0;
    let sepY = 0;
    let sepZ = 0;
    let aliX = 0;
    let aliY = 0;
    let aliZ = 0;
    let cohX = 0;
    let cohY = 0;
    let cohZ = 0;
    let neighbors = 0;

    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const o = birds[j];
      if (o.flockGroup !== b.flockGroup) continue;

      const dx = o.x - b.x;
      const dy = o.y - b.y;
      const dz = o.z - b.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < 64 && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        neighbors++;
        aliX += o.vx;
        aliY += o.vy;
        aliZ += o.vz;
        cohX += o.x;
        cohY += o.y;
        cohZ += o.z;

        if (dist < 2.8) {
          const push = (2.8 - dist) / 2.8;
          sepX -= (dx / dist) * push * 8.5;
          sepY -= (dy / dist) * push * 5.0;
          sepZ -= (dz / dist) * push * 8.5;
        }
      }
    }

    let ax = sepX;
    let ay = sepY;
    let az = sepZ;

    if (neighbors > 0) {
      aliX /= neighbors;
      aliY /= neighbors;
      aliZ /= neighbors;
      cohX = cohX / neighbors - b.x;
      cohY = cohY / neighbors - b.y;
      cohZ = cohZ / neighbors - b.z;

      ax += (aliX - b.vx) * 0.45 + cohX * 0.38;
      ay += (aliY - b.vy) * 0.45 + cohY * 0.32;
      az += (aliZ - b.vz) * 0.45 + cohZ * 0.38;
    }

    // Tangential orbital flow + soft radius spring around basilica spire silhouette
    const rHoriz = Math.hypot(b.x, b.z) || 0.001;
    const rx = b.x / rHoriz;
    const rz = b.z / rHoriz;
    const tx = -rz * b.orbitDir;
    const tz = rx * b.orbitDir;

    const targetR = b.orbitRadius + Math.sin(elapsed * 0.3 + b.flockGroup * 2.1) * 2.2;
    const radialCorrection = (targetR - rHoriz) * 0.72;
    const spireRepulsion = rHoriz < 13.5 ? (13.5 - rHoriz) * 3.4 : 0;

    ax += tx * 3.8 + rx * (radialCorrection + spireRepulsion);
    az += tz * 3.8 + rz * (radialCorrection + spireRepulsion);

    const targetY =
      b.baseHeight + Math.sin(elapsed * 0.55 + b.wingPhase * 0.25) * (b.flockGroup === 0 ? 3.2 : 1.5);
    ay += (targetY - b.y) * 1.15;

    const prevVx = b.vx;
    const prevVz = b.vz;

    b.vx += ax * safeDt;
    b.vy += ay * safeDt;
    b.vz += az * safeDt;

    // Clamp flight speed to natural swift/pigeon cruise envelope
    const speed = Math.hypot(b.vx, b.vy, b.vz) || 1;
    const minSpeed = b.flockGroup === 0 ? 7.2 : 5.4;
    const maxSpeed = b.flockGroup === 0 ? 11.0 : 8.6;
    const clampedSpeed = Math.max(minSpeed, Math.min(maxSpeed, speed));
    const scaleFactor = clampedSpeed / speed;
    b.vx *= scaleFactor;
    b.vy *= scaleFactor;
    b.vz *= scaleFactor;

    b.x += b.vx * safeDt;
    b.y = Math.max(4.5, Math.min(48.0, b.y + b.vy * safeDt));
    b.z += b.vz * safeDt;

    // Bank into horizontal turn (cross product sign of prev velocity & new velocity)
    const turnCross = prevVx * b.vz - prevVz * b.vx;
    const desiredBank = Math.max(-0.55, Math.min(0.55, turnCross * 0.08 + b.orbitDir * 0.22));
    b.bankAngle += (desiredBank - b.bankAngle) * Math.min(1, safeDt * 6);

    // Beat faster when climbing, glide briefly on gentle descents
    const climbMod = b.vy > -0.35 ? 1.0 : 0.3;
    b.wingPhase += b.wingSpeed * climbMod * safeDt;
  }
}

export function computeWingFlapAngle(wingPhase: number, vy: number): number {
  const glideBlend = vy < -0.55 ? 0.22 : 1.0;
  return Math.sin(wingPhase) * 0.68 * glideBlend + 0.08;
}
