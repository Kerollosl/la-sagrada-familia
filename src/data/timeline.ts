export const MIN_YEAR = 1882;
export const MAX_YEAR = 2026;

export type PhaseId = 'phase1' | 'phase2' | 'phase3' | 'phase4';

export interface EraMilestone {
  id: string;
  year: number;
  shortLabel: string;
  title: string;
  architect: string;
  yearsSpan: string;
  summary: string;
  activePhase: PhaseId | 'hiatus';
  cameraHint?: {
    azimuthDeg: number;
    elevationDeg: number;
    distance: number;
  };
}

export interface PhaseInfo {
  id: PhaseId;
  label: string;
  yearsLabel: string;
  startYear: number;
  endYear: number;
  swatchHex: string;
  maxHeightMeters: number;
}

export interface PhaseProgressState {
  phase1: number;
  phase2: number;
  phase3: number;
  phase4: number;
  crypt: number;
  apse: number;
  nativityBody: number;
  nativityTowers: number;
  passionBody: number;
  passionTowers: number;
  naveWalls: number;
  naveVaults: number;
  stainedGlassGlow: number;
  evangelistTowers: number;
  virginMaryTower: number;
  jesusTower: number;
  gloryFacade: number;
  overallCompletionPct: number;
}

export const PHASES: PhaseInfo[] = [
  {
    id: 'phase1',
    label: 'Crypt, Apse & Nativity',
    yearsLabel: '1882–1926',
    startYear: 1882,
    endYear: 1926,
    swatchHex: '#d4b483',
    maxHeightMeters: 107,
  },
  {
    id: 'phase2',
    label: 'Passion Facade',
    yearsLabel: '1952–1976',
    startYear: 1952,
    endYear: 1976,
    swatchHex: '#d8d2c7',
    maxHeightMeters: 112,
  },
  {
    id: 'phase3',
    label: 'Central Nave & Vaults',
    yearsLabel: '1978–2010',
    startYear: 1978,
    endYear: 2010,
    swatchHex: '#e3c79c',
    maxHeightMeters: 54,
  },
  {
    id: 'phase4',
    label: 'Central Towers & Glory',
    yearsLabel: '2010–2026+',
    startYear: 2010,
    endYear: 2026,
    swatchHex: '#f1d693',
    maxHeightMeters: 172.5,
  },
];

export const KEY_MILESTONES: EraMilestone[] = [
  {
    id: 'start-1882',
    year: 1882,
    shortLabel: '1882 Start',
    title: 'Neo-Gothic Foundations & Crypt',
    architect: 'Francisco de Paula del Villar',
    yearsSpan: '1882–1883',
    summary:
      'Construction began in March 1882 under diocesan architect Francisco de Paula del Villar with a conventional Neo-Gothic crypt beneath the apse. Within a year, Antoni Gaudí took over the commission and radically reimagined the basilica in organic Catalan Modernisme.',
    activePhase: 'phase1',
    cameraHint: { azimuthDeg: 140, elevationDeg: 22, distance: 72 },
  },
  {
    id: 'gaudi-1926',
    year: 1926,
    shortLabel: "1926 Gaudí's Death",
    title: 'Apse & Nativity Bell Towers',
    architect: 'Antoni Gaudí',
    yearsSpan: '1883–1926',
    summary:
      'Gaudí devoted his final decades exclusively to the temple, completing the radiating apse chapels, the sculptural Nativity Facade, and the first soaring bell towers crowned with Venetian-inspired finials. Upon his death in 1926, roughly a quarter of the basilica stood complete alongside detailed plaster models.',
    activePhase: 'phase1',
    cameraHint: { azimuthDeg: 62, elevationDeg: 18, distance: 74 },
  },
  {
    id: 'passion-1976',
    year: 1976,
    shortLabel: '1976 Passion Towers',
    title: 'The Angular Passion Facade',
    architect: 'Francesc Quintana, Isidre Puig Boada & Lluís Bonet',
    yearsSpan: '1952–1976',
    summary:
      'Following wartime interruptions, Gaudí’s disciples translated his skeletal Passion drawings into six inclined, bone-like buttress pillars on the western transept. By 1976 all four stark, geometric bell towers of the Passion Facade reached their 112-meter zenith.',
    activePhase: 'phase2',
    cameraHint: { azimuthDeg: -66, elevationDeg: 19, distance: 76 },
  },
  {
    id: 'consecration-2010',
    year: 2010,
    shortLabel: '2010 Consecration',
    title: 'Branching Nave & Hyperboloid Vaults',
    architect: 'Jordi Bonet i Armengol',
    yearsSpan: '1978–2010',
    summary:
      'With computer-aided structural modeling, Jordi Bonet’s team erected the forest of double-twisted branching columns and interlocking hyperboloid ceiling vaults across the vast central nave. The completed interior enclosure and jewel-toned stained glass were consecrated by Pope Benedict XVI in November 2010.',
    activePhase: 'phase3',
    cameraHint: { azimuthDeg: 38, elevationDeg: 22, distance: 78 },
  },
  {
    id: 'completion-2026',
    year: 2026,
    shortLabel: '2026 Completion',
    title: 'Central Towers & Glory Threshold',
    architect: 'Jordi Faulí i Oller',
    yearsSpan: '2010–2026+',
    summary:
      'High-tension post-tensioned stone blocks enabled rapid assembly of the four winged Evangelist towers, the 138-meter Tower of the Virgin Mary crowned with a glowing 12-pointed star, and the 172.5-meter Tower of Jesus Christ. Marking the centenary of Gaudí’s passing, the central cross crowns Barcelona’s skyline while the monumental Glory Facade advances.',
    activePhase: 'phase4',
    cameraHint: { azimuthDeg: 42, elevationDeg: 15, distance: 108 },
  },
];

interface HistoricalSegment {
  from: number;
  to: number;
  title: string;
  architect: string;
  yearsSpan: string;
  summary: string;
  activePhase: PhaseId | 'hiatus';
}

const HISTORICAL_SEGMENTS: HistoricalSegment[] = [
  {
    from: 1882,
    to: 1884,
    title: 'Neo-Gothic Crypt Foundations',
    architect: 'Francisco de Paula del Villar',
    yearsSpan: '1882–1883',
    summary:
      'Construction began in March 1882 under diocesan architect Francisco de Paula del Villar with a Neo-Gothic crypt beneath the apse. In late 1883, thirty-one-year-old Antoni Gaudí assumed leadership and completely transformed the basilica’s structural vision.',
    activePhase: 'phase1',
  },
  {
    from: 1884,
    to: 1906,
    title: 'Crypt Completion & Radiating Apse',
    architect: 'Antoni Gaudí',
    yearsSpan: '1884–1906',
    summary:
      'Gaudí vaulted the crypt and raised the polygonal Neo-Gothic apse walls with seven radiating chapels and towering outer pinnacles. During this era he also developed his famous hanging chain models to calculate catenary equilibrium.',
    activePhase: 'phase1',
  },
  {
    from: 1906,
    to: 1926.9,
    title: 'Nativity Facade & Bell Towers',
    architect: 'Antoni Gaudí',
    yearsSpan: '1906–1926',
    summary:
      'Focusing all energy on the eastern Nativity Facade, Gaudí sculpted three richly detailed portals beneath the Cypress Tree of Life and raised its four parabolic bell towers. By his death in June 1926, the first tower stood complete and the remaining three were well underway.',
    activePhase: 'phase1',
  },
  {
    from: 1926.9,
    to: 1952,
    title: 'Completion of Nativity & Wartime Pause',
    architect: 'Domènec Sugrañes · Francesc Quintana',
    yearsSpan: '1926–1951',
    summary:
      'Gaudí’s close collaborator Domènec Sugrañes finished the remaining three Nativity bell towers by 1930 before the Spanish Civil War halted work and damaged the workshop models. During the 1940s, architects carefully pieced back Gaudí’s shattered plaster prototypes to resume construction.',
    activePhase: 'phase1',
  },
  {
    from: 1952,
    to: 1976.9,
    title: 'Passion Facade & Bone-Like Pillars',
    architect: 'Francesc Quintana, Isidre Puig Boada & Lluís Bonet',
    yearsSpan: '1952–1976',
    summary:
      'Work opened on the western transept with the stark, austere Passion Facade, anchored by six inclined bone-like buttress columns supporting a severe cornice. By 1976 all four angular geometric bell towers rose to 112 meters.',
    activePhase: 'phase2',
  },
  {
    from: 1976.9,
    to: 1995,
    title: 'Nave Walls & Forest Columns Begin',
    architect: 'Jordi Bonet i Armengol',
    yearsSpan: '1978–1995',
    summary:
      'Builders shifted to the vast central nave, laying foundations and raising outer clerestory walls alongside the first double-twisted tree columns. Early CAD modeling helped translate Gaudí’s complex ruled hyperboloid geometries into stone formwork.',
    activePhase: 'phase3',
  },
  {
    from: 1995,
    to: 2010.5,
    title: 'Hyperboloid Vaults & Consecration',
    architect: 'Jordi Bonet i Armengol',
    yearsSpan: '1995–2010',
    summary:
      'Branching stone canopies interlocked into luminous hyperboloid vaults 45 meters above the nave floor, enclosing the basilica roof and jewel-toned stained-glass clerestory. On November 7, 2010, Pope Benedict XVI consecrated the church as a Minor Basilica.',
    activePhase: 'phase3',
  },
  {
    from: 2010.5,
    to: 2021.9,
    title: 'Evangelist & Virgin Mary Towers',
    architect: 'Jordi Faulí i Oller',
    yearsSpan: '2010–2021',
    summary:
      'Using prefabricated post-tensioned stone panels, Jordi Faulí’s team accelerated construction of the six central towers above the crossing and apse. In December 2021, the 138-meter Tower of the Virgin Mary was crowned with an illuminated twelve-pointed crystal star.',
    activePhase: 'phase4',
  },
  {
    from: 2021.9,
    to: 2027,
    title: 'Tower of Jesus Christ & Glory Facade',
    architect: 'Jordi Faulí i Oller',
    yearsSpan: '2022–2026+',
    summary:
      'With the winged tetramorph sculptures crowning the four Evangelist towers in 2023, the central Tower of Jesus Christ ascended to 172.5 meters topped by its four-armed glazed cross. Marking the 2026 centenary of Gaudí’s death, structural focus turns to completing the monumental Glory Facade.',
    activePhase: 'phase4',
  },
];

export function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function smoothstep01(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

export function rangeProgress(year: number, start: number, end: number): number {
  if (end <= start) return year >= end ? 1 : 0;
  return smoothstep01((year - start) / (end - start));
}

export function computePhaseProgress(rawYear: number): PhaseProgressState {
  const year = Math.min(MAX_YEAR, Math.max(MIN_YEAR, rawYear));

  // Phase 1: 1882–1930 (core Nativity & Apse built 1882–1926, remaining tower spires completed 1930)
  const crypt = rangeProgress(year, 1882, 1891);
  const apse = rangeProgress(year, 1888, 1904);
  const nativityBody = rangeProgress(year, 1898, 1918);
  const nativityTowers = rangeProgress(year, 1912, 1929);
  const phase1 = rangeProgress(year, 1882, 1929);

  // Phase 2: 1952–1976 Passion Facade
  const passionBody = rangeProgress(year, 1952, 1966);
  const passionTowers = rangeProgress(year, 1962, 1976);
  const phase2 = rangeProgress(year, 1952, 1976);

  // Phase 3: 1978–2010 Central Nave & Vaults
  const naveWalls = rangeProgress(year, 1978, 1998);
  const naveVaults = rangeProgress(year, 1992, 2009);
  const stainedGlassGlow = rangeProgress(year, 2004, 2011);
  const phase3 = rangeProgress(year, 1978, 2010);

  // Phase 4: 2010–2026 Central Towers & Glory Facade
  const virginMaryTower = rangeProgress(year, 2014, 2021.8);
  const evangelistTowers = rangeProgress(year, 2015, 2023.8);
  const jesusTower = rangeProgress(year, 2016, 2026.0);
  const gloryFacade = rangeProgress(year, 2018, 2026.0);
  const phase4 = rangeProgress(year, 2011, 2026);

  const overallCompletionPct = Math.round(
    (phase1 * 0.25 + phase2 * 0.2 + phase3 * 0.27 + phase4 * 0.28) * 100
  );

  return {
    phase1,
    phase2,
    phase3,
    phase4,
    crypt,
    apse,
    nativityBody,
    nativityTowers,
    passionBody,
    passionTowers,
    naveWalls,
    naveVaults,
    stainedGlassGlow,
    evangelistTowers,
    virginMaryTower,
    jesusTower,
    gloryFacade,
    overallCompletionPct,
  };
}

export function getHistoricalContext(rawYear: number): HistoricalSegment {
  const year = Math.min(MAX_YEAR, Math.max(MIN_YEAR, rawYear));
  for (const segment of HISTORICAL_SEGMENTS) {
    if (year >= segment.from && year < segment.to) {
      return segment;
    }
  }
  return HISTORICAL_SEGMENTS[HISTORICAL_SEGMENTS.length - 1];
}

export function getActiveConstructionPhases(progress: PhaseProgressState): PhaseId[] {
  const active: PhaseId[] = [];
  if (progress.phase1 > 0.01 && progress.phase1 < 0.99) active.push('phase1');
  if (progress.phase2 > 0.01 && progress.phase2 < 0.99) active.push('phase2');
  if (progress.phase3 > 0.01 && progress.phase3 < 0.99) active.push('phase3');
  if (progress.phase4 > 0.01 && progress.phase4 < 0.99) active.push('phase4');
  return active;
}

export function formatYearDisplay(year: number): string {
  const rounded = Math.round(year);
  return rounded >= MAX_YEAR ? '2026+' : String(rounded);
}
