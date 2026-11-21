export interface ArchitecturalFeature {
  id: string;
  label: string;
  category: 'Facade' | 'Interior & Roof' | 'Central Spires' | 'Crypt & Apse';
  eraLabel: string;
  revealYear: number;
  architect: string;
  dimensions: string;
  summary: string;
  trivia: string[];
  anchorPosition: [number, number, number];
  hitRadius: number;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
}

export const ARCHITECTURAL_FEATURES: ArchitecturalFeature[] = [
  {
    id: 'nativity-portal',
    label: 'Nativity Portals',
    category: 'Facade',
    eraLabel: 'Phase 1 · 1894–1930',
    revealYear: 1900,
    architect: 'Antoni Gaudí',
    dimensions: '3 Portals · East Transept · 4 Bell Towers (98–107 m)',
    summary:
      'Gaudí completed this exuberant east facade first so Barcelona could witness his organic language of living stone, carved foliage, and joyous nativity sculptures.',
    trivia: [
      'Crowned a UNESCO World Heritage Site in 2005 for the parts built directly under Gaudí’s supervision.',
      'The three portals represent Faith, Hope, and Charity, framed by sculpted turtles, chameleons, and Montjuïc sandstone reliefs.',
      'Unlike the burned studio workshop in 1936, the Nativity Facade stood intact and preserved Gaudí’s sculptural proportions.',
    ],
    anchorPosition: [8.6, 5.4, 2.4],
    hitRadius: 4.4,
    cameraPosition: [25.5, 9.2, 11.5],
    cameraTarget: [8.0, 6.2, 0.2],
  },
  {
    id: 'apse-chapels',
    label: 'Neo-Gothic Apse',
    category: 'Crypt & Apse',
    eraLabel: 'Phase 1 · 1885–1893',
    revealYear: 1892,
    architect: 'Francisco de Paula del Villar & Antoni Gaudí',
    dimensions: '7 Polygonal Chapels · North Head · Ambulatory Pinnacles',
    summary:
      'Rising directly above the 1882 crypt, the semicircular apse bridges del Villar’s Neo-Gothic stone buttresses with Gaudí’s naturalistic botanical pinnacles.',
    trivia: [
      'Seven radiating chapels encircle the altar, dedicated to the Seven Joys and Seven Sorrows of Saint Joseph.',
      'Gaudí transformed traditional medieval gargoyles along the upper cornice into native Catalan amphibians, snails, and owls.',
      'Staircases inside the apse turrets spiral around hollow stone cores without a central vertical support shaft.',
    ],
    anchorPosition: [4.8, 8.6, -12.4],
    hitRadius: 4.6,
    cameraPosition: [14.5, 13.0, -29.5],
    cameraTarget: [0.0, 6.4, -8.5],
  },
  {
    id: 'passion-portal',
    label: 'Passion Portals',
    category: 'Facade',
    eraLabel: 'Phase 2 · 1954–1976',
    revealYear: 1962,
    architect: 'Francesc Quintana, Isidre Puig Boada & Josep Maria Subirachs',
    dimensions: '6 Inclined Bone Pillars · West Transept · 4 Towers (107–112 m)',
    summary:
      'Inspired by Gaudí’s stark 1911 sketches made while recovering from Malta fever, six tilted bone-like columns support a dramatic angular pediment facing the setting sun.',
    trivia: [
      'Sculptor Josep Maria Subirachs carved 100+ angular stone figures and a 4×4 Magic Square on the portal whose rows and diagonals all sum to 33.',
      'Its bare, sinewy columns mimic human rib bones and tendons to evoke the austerity and sacrifice of Christ’s Passion.',
      'The upper sky-bridge between the central bell towers supports a bronze sculpture depicting Christ’s Ascension.',
    ],
    anchorPosition: [-9.2, 5.8, -2.0],
    hitRadius: 4.5,
    cameraPosition: [-26.5, 9.6, 10.5],
    cameraTarget: [-8.2, 6.6, 0.0],
  },
  {
    id: 'nave-vaults',
    label: 'Hyperboloid Vaults',
    category: 'Interior & Roof',
    eraLabel: 'Phase 3 · 1978–2010',
    revealYear: 1995,
    architect: 'Jordi Bonet i Armengol',
    dimensions: '45 m Nave Canopy · Double-Twist Columns · 48 Stained-Glass Bays',
    summary:
      'Gaudí modeled the interior as a sunlit stone forest where slanted porphyry, basalt, and granite columns branch upward into perforated hyperboloid vaults.',
    trivia: [
      'Columns rotate from polygonal bases (4 to 12 sides) into smooth circles through double-twisted helicoidal geometry.',
      'Cool blue-green stained glass on the east catches the dawn, transitioning to fiery reds and ambers on the west at sunset.',
      'Aeronautical and naval structural software was adapted in the 1990s to compute the exact stone vault intersections.',
    ],
    anchorPosition: [-4.6, 14.5, 4.2],
    hitRadius: 4.8,
    cameraPosition: [-21.0, 17.5, 21.5],
    cameraTarget: [-1.5, 11.2, 0.5],
  },
  {
    id: 'evangelist-towers',
    label: 'Evangelist Towers',
    category: 'Central Spires',
    eraLabel: 'Phase 4 · 2016–2023',
    revealYear: 2023,
    architect: 'Jordi Faulí i Oller & Xavier Medina-Campeny',
    dimensions: '4 Towers · 135 m Full Scale · Winged Tetramorph Finals',
    summary:
      'Surrounding the central Tower of Jesus Christ, four parabolic towers celebrate Matthew, Mark, Luke, and John with illuminated white marble winged sculptures.',
    trivia: [
      'Completed in November 2023 with the traditional winged symbols: angel (Matthew), lion (Mark), ox (Luke), and eagle (John).',
      'Built using post-tensioned stone panels pre-assembled off-site and lifted by high-altitude tower cranes.',
      'Geometric books held beneath each sculpture bear the initials of the four Gospels.',
    ],
    anchorPosition: [4.2, 31.0, 3.8],
    hitRadius: 3.8,
    cameraPosition: [19.5, 34.5, 18.5],
    cameraTarget: [2.2, 29.5, 1.8],
  },
  {
    id: 'virgin-mary-star',
    label: 'Virgin Mary Star',
    category: 'Central Spires',
    eraLabel: 'Phase 4 · 2016–2021',
    revealYear: 2021,
    architect: 'Jordi Faulí i Oller',
    dimensions: '138 m Full Scale · 7.5 m Diameter · 12-Pointed Illuminated Star',
    summary:
      'Rising behind the apse, the second-tallest spire of the basilica culminates in a luminous blue trencadís obelisk topped by a 5.5-ton crystalline star.',
    trivia: [
      'First illuminated on December 8, 2021, becoming the first of the six central towers to be completed.',
      'Its 12-pointed pyramidal star uses textured laminated glass panes engineered to withstand Mediterranean gales.',
      'A dramatic 800-square-meter hyperboloid oculus below channels daylight straight down into the main altar.',
    ],
    anchorPosition: [-1.2, 36.2, -6.2],
    hitRadius: 3.8,
    cameraPosition: [18.5, 40.5, -24.0],
    cameraTarget: [0.0, 33.8, -6.0],
  },
  {
    id: 'jesus-tower',
    label: 'Tower of Jesus Christ',
    category: 'Central Spires',
    eraLabel: 'Phase 4 · 2018–2026',
    revealYear: 2024,
    architect: 'Jordi Faulí i Oller',
    dimensions: '172.5 m Full Scale · World’s Tallest Church Spire · Four-Armed Cross',
    summary:
      'At the architectural summit of Barcelona’s skyline, the central cimborrio ascends to 172.5 meters and terminates in a 17-meter glazed ceramic and glass cross.',
    trivia: [
      'Gaudí deliberately capped the height at 172.5 meters so it would remain 5 meters shorter than Montjuïc, believing human creation should not surpass God’s hill.',
      'The four-armed cross echoes Gaudí’s rooftop chimneys at Casa Batlló and Palau Güell, containing an accessible panoramic core.',
      'Its completion coincides with 2026, marking the centenary of Antoni Gaudí’s passing.',
    ],
    anchorPosition: [0.0, 44.8, 0.0],
    hitRadius: 4.2,
    cameraPosition: [18.5, 45.5, 21.0],
    cameraTarget: [0.0, 40.0, 0.0],
  },
  {
    id: 'glory-facade',
    label: 'Glory Facade',
    category: 'Facade',
    eraLabel: 'Phase 4 · 2002–2026+',
    revealYear: 2025,
    architect: 'Jordi Bonet, Josep Maria Subirachs & Jordi Faulí',
    dimensions: 'Principal South Entrance · 7 Colossal Lantern Columns · Bronze Portals',
    summary:
      'Serving as the grand main entrance on Carrer de Mallorca, the Glory Facade pairs monumental entry steps and golden solar rays with a cloud-crowned portico.',
    trivia: [
      'Sculptor Josep Maria Subirachs cast the monumental 2-ton bronze doors inscribed with the Lord’s Prayer in 50 languages.',
      'Seven tall columns represent the Seven Gifts of the Holy Spirit, alongside reliefs exploring human virtues and vices.',
      'Gaudí originally envisioned a grand stairway spanning across Carrer de Mallorca to elevate visitors toward the main nave.',
    ],
    anchorPosition: [0.0, 5.8, 13.6],
    hitRadius: 4.8,
    cameraPosition: [12.5, 11.0, 34.0],
    cameraTarget: [0.0, 6.2, 10.8],
  },
];

export function getFeatureById(id: string | null | undefined): ArchitecturalFeature | null {
  if (!id) return null;
  return ARCHITECTURAL_FEATURES.find((f) => f.id === id) ?? null;
}

export function getVisibleFeaturesForYear(year: number): ArchitecturalFeature[] {
  return ARCHITECTURAL_FEATURES.filter((f) => year >= f.revealYear - 2);
}
