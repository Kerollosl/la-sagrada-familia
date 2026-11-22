export type StackMode = 'drop' | 'growY' | 'pop';

export interface StackTransform {
  visible: boolean;
  offsetY: number;
  offsetX: number;
  offsetZ: number;
  scaleXY: number;
  scaleY: number;
  localT: number;
}

function clamp01(v: number): number {
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return v;
}

/**
 * Computes deterministic piece-by-piece masonry stacking transform for a single
 * architectural element given its phase progress [0..1] and build window [start..end].
 */
export function computeStackTransform(
  progress: number,
  start: number,
  end: number,
  dropHeight = 5.0,
  mode: StackMode = 'drop'
): StackTransform {
  const span = Math.max(0.0001, end - start);
  const rawT = (progress - start) / span;

  if (rawT <= 0.001) {
    return {
      visible: false,
      offsetY: dropHeight,
      offsetX: 0,
      offsetZ: 0,
      scaleXY: 0.01,
      scaleY: 0.01,
      localT: 0,
    };
  }

  if (rawT >= 1) {
    return {
      visible: true,
      offsetY: 0,
      offsetX: 0,
      offsetZ: 0,
      scaleXY: 1,
      scaleY: 1,
      localT: 1,
    };
  }

  const localT = clamp01(rawT);
  // Descent decelerates hard near the seat, like a stone eased down on a crane line.
  const descent = 1 - Math.pow(1 - localT, 4);
  const appear = clamp01(localT * 4);
  const appearEase = appear * appear * (3 - 2 * appear);
  // Contact squash in the final 15%: the piece beds into its mortar, then recovers.
  const contact = clamp01((localT - 0.85) / 0.15);
  const squash = Math.sin(contact * Math.PI) * 0.045;
  // Pendulum sway while hanging, damped out before contact.
  const swing = Math.sin(localT * Math.PI * 3.5) * Math.pow(1 - localT, 2) * dropHeight * 0.06;

  if (mode === 'growY') {
    const rise = 1 - Math.pow(1 - localT, 3);
    return {
      visible: true,
      offsetY: 0,
      offsetX: 0,
      offsetZ: 0,
      scaleXY: 0.94 + 0.06 * appearEase,
      scaleY: 0.04 + 0.96 * rise,
      localT,
    };
  }

  if (mode === 'pop') {
    // Ease-out with a small overshoot so inset glass and ornaments snap into their frames.
    const t1 = localT - 1;
    const back = 1 + 2.4 * t1 * t1 * t1 + 1.4 * t1 * t1;
    return {
      visible: true,
      offsetY: (1 - descent) * (dropHeight * 0.2),
      offsetX: 0,
      offsetZ: 0,
      scaleXY: Math.max(0.01, 0.3 + 0.7 * back),
      scaleY: Math.max(0.01, 0.3 + 0.7 * back),
      localT,
    };
  }

  // 'drop': crane-lowered stone assembly descending onto its masonry seat
  return {
    visible: true,
    offsetY: (1 - descent) * dropHeight,
    offsetX: swing,
    offsetZ: swing * 0.6,
    scaleXY: (0.9 + 0.1 * appearEase) * (1 + squash * 0.5),
    scaleY: (0.9 + 0.1 * appearEase) * (1 - squash),
    localT,
  };
}
