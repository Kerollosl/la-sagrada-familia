export type StackMode = 'drop' | 'growY' | 'pop';

export interface StackTransform {
  visible: boolean;
  offsetY: number;
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
      scaleXY: 0.01,
      scaleY: 0.01,
      localT: 0,
    };
  }

  if (rawT >= 1) {
    return {
      visible: true,
      offsetY: 0,
      scaleXY: 1,
      scaleY: 1,
      localT: 1,
    };
  }

  const localT = clamp01(rawT);
  const easedDrop = 1 - Math.pow(1 - localT, 3);
  const appear = clamp01(localT * 3.2);
  const appearEase = 1 - Math.pow(1 - appear, 2);

  if (mode === 'growY') {
    return {
      visible: true,
      offsetY: 0,
      scaleXY: 0.86 + 0.14 * appearEase,
      scaleY: 0.08 + 0.92 * easedDrop,
      localT,
    };
  }

  if (mode === 'pop') {
    return {
      visible: true,
      offsetY: (1 - easedDrop) * (dropHeight * 0.25),
      scaleXY: 0.22 + 0.78 * easedDrop,
      scaleY: 0.22 + 0.78 * easedDrop,
      localT,
    };
  }

  // 'drop': crane-lowered stone assembly descending onto its masonry seat
  return {
    visible: true,
    offsetY: (1 - easedDrop) * dropHeight,
    scaleXY: 0.74 + 0.26 * appearEase,
    scaleY: 0.74 + 0.26 * appearEase,
    localT,
  };
}
