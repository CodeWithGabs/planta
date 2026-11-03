/**
 * Catálogo de móveis. Cada peça é descrita por partes em frações das
 * dimensões do móvel (w = largura/x, d = profundidade/z, h = altura/y),
 * então redimensionar o móvel redimensiona o modelo 3D e o símbolo 2D.
 *
 * Convenção local: x ∈ [-0.5, 0.5] (largura), z ∈ [-0.5, 0.5] (profundidade,
 * -0.5 = "fundo", encostado na parede), y ∈ [0, 1] a partir do piso.
 */

export type PartColor = 'main' | string;

export interface BoxPart {
  t: 'box';
  x: number;
  z: number;
  y: number;
  sx: number;
  sz: number;
  sy: number;
  c: PartColor;
  /** material especial */
  m?: 'glass' | 'metal' | 'fabric';
}

export interface CylPart {
  t: 'cyl';
  x: number;
  z: number;
  y: number;
  /** raio em fração da largura (x) e da profundidade (z) */
  rx: number;
  rz: number;
  sy: number;
  c: PartColor;
  m?: 'glass' | 'metal' | 'fabric';
}

export type Part = BoxPart | CylPart;

export interface CatalogItem {
  id: string;
  name: string;
  category: Category;
  w: number;
  d: number;
  h: number;
  elevation?: number;
  color: string;
  parts: Part[];
}

export const CATEGORIES = [
  'Quarto',
  'Sala',
  'Cozinha',
  'Banheiro',
  'Escritório',
  'Área de serviço',
  'Decoração',
] as const;
export type Category = (typeof CATEGORIES)[number];

const B = (x: number, y: number, z: number, sx: number, sy: number, sz: number, c: PartColor = 'main', m?: BoxPart['m']): BoxPart => ({
  t: 'box',
  x,
  y,
  z,
  sx,
  sy,
  sz,
  c,
  m,
});
const C = (x: number, y: number, z: number, rx: number, rz: number, sy: number, c: PartColor = 'main', m?: CylPart['m']): CylPart => ({
  t: 'cyl',
  x,
  y,
  z,
  rx,
  rz,
  sy,
  c,
  m,
});

const WHITE = '#f5f3ee';
const LINEN = '#ece6da';
const DARK = '#3b3b3f';
const STEEL = '#b9bec4';
const WOOD = '#a0764e';
const CERAMIC = '#fbfbfb';

/** quatro pernas finas nos cantos */
function legs(inset = 0.45, insetZ = 0.42, height = 1, size = 0.05, c: PartColor = DARK): Part[] {
  return [
    B(-inset, 0, -insetZ, size, height, size * 1.2, c),
    B(inset, 0, -insetZ, size, height, size * 1.2, c),
    B(-inset, 0, insetZ, size, height, size * 1.2, c),
    B(inset, 0, insetZ, size, height, size * 1.2, c),
  ];
}

function bed(pillows: number): Part[] {
  const ps: Part[] = [];
  const pw = 0.9 / pillows;
  for (let i = 0; i < pillows; i++) {
    ps.push(B(-0.45 + pw * (i + 0.5), 0.56, -0.38, pw * 0.88, 0.09, 0.12, '#ffffff', 'fabric'));
  }
  return [
    B(0, 0, 0.02, 1, 0.34, 0.96),
    B(0, 0, -0.48, 1, 1, 0.04),
    B(0, 0.34, 0.03, 0.96, 0.22, 0.92, LINEN, 'fabric'),
    B(0, 0.56, 0.16, 0.98, 0.025, 0.66, '#8fa9c9', 'fabric'),
    ...ps,
  ];
}

function sofa(seats: number): Part[] {
  const cushions: Part[] = [];
  const inner = 0.84;
  const cw = inner / seats;
  for (let i = 0; i < seats; i++) {
    cushions.push(B(-inner / 2 + cw * (i + 0.5), 0.45, 0.1, cw * 0.96, 0.12, 0.66, 'main', 'fabric'));
  }
  return [
    B(0, 0.06, 0.05, 1, 0.39, 0.9, 'main', 'fabric'),
    B(0, 0.06, -0.39, 1, 0.94, 0.22, 'main', 'fabric'),
    B(-0.46, 0.06, 0.05, 0.08, 0.66, 0.9, 'main', 'fabric'),
    B(0.46, 0.06, 0.05, 0.08, 0.66, 0.9, 'main', 'fabric'),
    ...cushions,
    ...legs(0.46, 0.4, 0.06, 0.04, DARK),
  ];
}

function cabinet(doors: number, top: PartColor = 'main'): Part[] {
  const ps: Part[] = [B(0, 0, 0, 1, 0.97, 1), B(0, 0.97, 0, 1, 0.03, 1, top)];
  for (let i = 1; i < doors; i++) ps.push(B(-0.5 + i / doors, 0.05, 0.5, 0.005, 0.88, 0.01, DARK));
  for (let i = 0; i < doors; i++) ps.push(B(-0.5 + (i + 0.5) / doors + 0.35 / doors, 0.75, 0.51, 0.01, 0.12, 0.02, STEEL, 'metal'));
  return ps;
}

function diningTable(chairs: number): Part[] {
  return [B(0, 0.95, 0, 1, 0.05, 1), ...legs(0.45, 0.4, 0.95, 0.05), ...Array.from({ length: chairs }, () => [] as Part[]).flat()];
}

export const CATALOG: CatalogItem[] = [
  // ─── Quarto ──────────────────────────────────────────────
  { id: 'cama-casal', name: 'Cama de casal', category: 'Quarto', w: 148, d: 198, h: 95, color: '#c9b8a3', parts: bed(2) },
  { id: 'cama-queen', name: 'Cama queen', category: 'Quarto', w: 168, d: 208, h: 100, color: '#7d8a99', parts: bed(2) },
  { id: 'cama-king', name: 'Cama king', category: 'Quarto', w: 203, d: 213, h: 105, color: '#5b5f66', parts: bed(3) },
  { id: 'cama-solteiro', name: 'Cama de solteiro', category: 'Quarto', w: 98, d: 198, h: 85, color: '#d8c3a5', parts: bed(1) },
  {
    id: 'guarda-roupa',
    name: 'Guarda-roupa 3 portas',
    category: 'Quarto',
    w: 160,
    d: 55,
    h: 220,
    color: '#e8e2d6',
    parts: cabinet(3),
  },
  {
    id: 'guarda-roupa-grande',
    name: 'Guarda-roupa 6 portas',
    category: 'Quarto',
    w: 240,
    d: 60,
    h: 230,
    color: '#bfa58a',
    parts: cabinet(6),
  },
  {
    id: 'criado-mudo',
    name: 'Criado-mudo',
    category: 'Quarto',
    w: 45,
    d: 40,
    h: 55,
    color: '#a0764e',
    parts: [B(0, 0.12, 0, 1, 0.88, 1), B(0, 0.6, 0.5, 0.9, 0.003, 0.01, DARK), B(0, 0.78, 0.51, 0.25, 0.04, 0.02, STEEL, 'metal'), ...legs(0.44, 0.4, 0.12, 0.06)],
  },
  {
    id: 'comoda',
    name: 'Cômoda',
    category: 'Quarto',
    w: 110,
    d: 45,
    h: 90,
    color: '#f0ebe1',
    parts: [
      B(0, 0.08, 0, 1, 0.92, 1),
      ...[0.3, 0.55, 0.8].map((y) => B(0, y, 0.5, 0.94, 0.005, 0.01, DARK)),
      ...[0.2, 0.45, 0.7].map((y) => B(0, y, 0.51, 0.2, 0.03, 0.02, STEEL, 'metal')),
      ...legs(0.46, 0.4, 0.08, 0.04),
    ],
  },

  // ─── Sala ────────────────────────────────────────────────
  { id: 'sofa-2', name: 'Sofá 2 lugares', category: 'Sala', w: 160, d: 88, h: 85, color: '#7a8b7f', parts: sofa(2) },
  { id: 'sofa-3', name: 'Sofá 3 lugares', category: 'Sala', w: 215, d: 92, h: 88, color: '#8a8f99', parts: sofa(3) },
  {
    id: 'sofa-l',
    name: 'Sofá em L (chaise)',
    category: 'Sala',
    w: 260,
    d: 160,
    h: 88,
    color: '#9c8f80',
    parts: [
      B(0, 0.06, -0.22, 1, 0.39, 0.56, 'main', 'fabric'),
      B(0.33, 0.06, 0.06, 0.34, 0.39, 0.88, 'main', 'fabric'),
      B(0, 0.06, -0.43, 1, 0.94, 0.14, 'main', 'fabric'),
      B(-0.48, 0.06, -0.22, 0.04, 0.66, 0.56, 'main', 'fabric'),
      B(0.48, 0.06, 0.06, 0.04, 0.66, 0.88, 'main', 'fabric'),
      B(-0.32, 0.45, -0.17, 0.3, 0.12, 0.38, 'main', 'fabric'),
      B(-0.01, 0.45, -0.17, 0.3, 0.12, 0.38, 'main', 'fabric'),
      B(0.3, 0.45, 0.06, 0.32, 0.12, 0.8, 'main', 'fabric'),
    ],
  },
  {
    id: 'poltrona',
    name: 'Poltrona',
    category: 'Sala',
    w: 80,
    d: 82,
    h: 90,
    color: '#c58b5c',
    parts: sofa(1),
  },
  {
    id: 'mesa-centro',
    name: 'Mesa de centro',
    category: 'Sala',
    w: 100,
    d: 60,
    h: 40,
    color: '#8b6b4a',
    parts: [B(0, 0.88, 0, 1, 0.12, 1), B(0, 0.15, 0, 0.94, 0.06, 0.9), ...legs(0.46, 0.42, 0.88, 0.05)],
  },
  {
    id: 'rack',
    name: 'Rack com TV',
    category: 'Sala',
    w: 180,
    d: 45,
    h: 120,
    color: '#5c4a3d',
    parts: [
      B(0, 0.04, 0, 1, 0.38, 1),
      B(0, 0.42, -0.1, 0.62, 0.02, 0.2, DARK),
      B(0, 0.44, -0.1, 0.06, 0.06, 0.1, DARK),
      B(0, 0.5, -0.12, 0.7, 0.5, 0.05, '#151518'),
      B(-0.25, 0.12, 0.5, 0.004, 0.25, 0.01, DARK),
      B(0.25, 0.12, 0.5, 0.004, 0.25, 0.01, DARK),
    ],
  },
  {
    id: 'estante',
    name: 'Estante de livros',
    category: 'Sala',
    w: 90,
    d: 32,
    h: 190,
    color: '#a0764e',
    parts: [
      B(-0.48, 0, 0, 0.04, 1, 1),
      B(0.48, 0, 0, 0.04, 1, 1),
      B(0, 0, -0.47, 1, 1, 0.06),
      ...[0, 0.2, 0.4, 0.6, 0.8, 0.98].map((y) => B(0, y, 0, 0.92, 0.02, 1)),
      ...[0.02, 0.22, 0.42, 0.62].map((y, i) => B(-0.2 + (i % 2) * 0.3, y, 0, 0.4, 0.13, 0.7, ['#b24a3b', '#3c6e8f', '#d9a441', '#55785a'][i])),
    ],
  },

  // ─── Cozinha / jantar ────────────────────────────────────
  { id: 'mesa-4', name: 'Mesa de jantar 4 lugares', category: 'Cozinha', w: 120, d: 80, h: 76, color: '#a0764e', parts: diningTable(4) },
  { id: 'mesa-6', name: 'Mesa de jantar 6 lugares', category: 'Cozinha', w: 180, d: 90, h: 76, color: '#6e5038', parts: diningTable(6) },
  {
    id: 'mesa-redonda',
    name: 'Mesa redonda',
    category: 'Cozinha',
    w: 100,
    d: 100,
    h: 76,
    color: '#d8cbb8',
    parts: [C(0, 0.95, 0, 0.5, 0.5, 0.05), C(0, 0, 0, 0.06, 0.06, 0.95, DARK, 'metal'), C(0, 0, 0, 0.25, 0.25, 0.03, DARK, 'metal')],
  },
  {
    id: 'cadeira',
    name: 'Cadeira',
    category: 'Cozinha',
    w: 44,
    d: 50,
    h: 88,
    color: '#a0764e',
    parts: [B(0, 0.5, 0.04, 1, 0.05, 0.9), B(0, 0.55, -0.43, 1, 0.45, 0.08), ...legs(0.42, 0.38, 0.5, 0.08)],
  },
  {
    id: 'armario-cozinha',
    name: 'Balcão de cozinha',
    category: 'Cozinha',
    w: 120,
    d: 60,
    h: 90,
    color: '#f4f1ea',
    parts: cabinet(2, '#4a4a4f'),
  },
  {
    id: 'armario-aereo',
    name: 'Armário aéreo',
    category: 'Cozinha',
    w: 120,
    d: 35,
    h: 70,
    elevation: 150,
    color: '#f4f1ea',
    parts: cabinet(2),
  },
  {
    id: 'pia-cozinha',
    name: 'Pia de cozinha',
    category: 'Cozinha',
    w: 120,
    d: 60,
    h: 90,
    color: '#f4f1ea',
    parts: [
      B(0, 0, 0, 1, 0.95, 1),
      B(0, 0.95, 0, 1, 0.05, 1, '#8a8f96', 'metal'),
      B(-0.15, 0.9, 0.05, 0.45, 0.1, 0.65, '#cfd3d8', 'metal'),
      C(-0.15, 1, -0.38, 0.02, 0.04, 0.3, STEEL, 'metal'),
      B(-0.25, 0.1, 0.5, 0.004, 0.8, 0.01, DARK),
    ],
  },
  {
    id: 'fogao',
    name: 'Fogão 4 bocas',
    category: 'Cozinha',
    w: 55,
    d: 62,
    h: 90,
    color: '#dfe2e6',
    parts: [
      B(0, 0, 0, 1, 0.95, 1, 'main', 'metal'),
      B(0, 0.95, 0, 1, 0.02, 1, '#1c1c1f'),
      C(-0.22, 0.97, -0.2, 0.14, 0.12, 0.02, '#333'),
      C(0.22, 0.97, -0.2, 0.14, 0.12, 0.02, '#333'),
      C(-0.22, 0.97, 0.2, 0.14, 0.12, 0.02, '#333'),
      C(0.22, 0.97, 0.2, 0.14, 0.12, 0.02, '#333'),
      B(0, 0.2, 0.5, 0.8, 0.5, 0.01, '#1c1c1f', 'glass'),
    ],
  },
  {
    id: 'geladeira',
    name: 'Geladeira',
    category: 'Cozinha',
    w: 70,
    d: 72,
    h: 185,
    color: '#e6e8eb',
    parts: [B(0, 0, 0, 1, 1, 1, 'main', 'metal'), B(0, 0.68, 0.5, 1, 0.005, 0.01, '#999'), B(0.4, 0.72, 0.51, 0.03, 0.15, 0.02, '#999', 'metal'), B(0.4, 0.4, 0.51, 0.03, 0.2, 0.02, '#999', 'metal')],
  },
  {
    id: 'ilha',
    name: 'Ilha / bancada',
    category: 'Cozinha',
    w: 180,
    d: 90,
    h: 92,
    color: '#5b6e7a',
    parts: [B(0, 0, -0.05, 1, 0.95, 0.85), B(0, 0.95, 0, 1, 0.05, 1, '#eae7e1')],
  },

  // ─── Banheiro ────────────────────────────────────────────
  {
    id: 'vaso',
    name: 'Vaso sanitário',
    category: 'Banheiro',
    w: 38,
    d: 68,
    h: 78,
    color: CERAMIC,
    parts: [
      B(0, 0, -0.38, 0.9, 1, 0.24),
      C(0, 0, 0.1, 0.38, 0.32, 0.5),
      C(0, 0.5, 0.1, 0.45, 0.38, 0.04, '#e9e9e9'),
    ],
  },
  {
    id: 'pia-banheiro',
    name: 'Gabinete com pia',
    category: 'Banheiro',
    w: 80,
    d: 48,
    h: 85,
    color: '#ffffff',
    parts: [
      B(0, 0.1, -0.02, 1, 0.83, 0.96, '#9a7b5c'),
      B(0, 0.93, 0, 1, 0.07, 1, CERAMIC),
      C(0, 0.92, 0.08, 0.3, 0.32, 0.08, '#e3e6e9'),
      C(0, 1, -0.36, 0.03, 0.06, 0.25, STEEL, 'metal'),
    ],
  },
  {
    id: 'box',
    name: 'Box com chuveiro',
    category: 'Banheiro',
    w: 90,
    d: 90,
    h: 200,
    color: '#dde3e8',
    parts: [
      B(0, 0, 0, 1, 0.02, 1, '#e7e7e7'),
      B(0, 0.02, 0.49, 1, 0.98, 0.02, '#cfe3ec', 'glass'),
      B(-0.49, 0.02, 0, 0.02, 0.98, 1, '#cfe3ec', 'glass'),
      C(0.3, 0.92, -0.3, 0.1, 0.1, 0.02, STEEL, 'metal'),
      B(0.3, 0.93, -0.42, 0.02, 0.02, 0.2, STEEL, 'metal'),
    ],
  },
  {
    id: 'banheira',
    name: 'Banheira',
    category: 'Banheiro',
    w: 170,
    d: 75,
    h: 58,
    color: CERAMIC,
    parts: [B(0, 0, 0, 1, 1, 1), B(0, 0.4, 0, 0.9, 0.62, 0.8, '#d9edf5')],
  },

  // ─── Escritório ──────────────────────────────────────────
  {
    id: 'escrivaninha',
    name: 'Escrivaninha',
    category: 'Escritório',
    w: 120,
    d: 60,
    h: 75,
    color: '#ddd3c4',
    parts: [B(0, 0.95, 0, 1, 0.05, 1), ...legs(0.47, 0.44, 0.95, 0.04, DARK), B(0, 1, -0.2, 0.4, 0.4, 0.04, '#151518'), B(0, 1, 0.15, 0.35, 0.02, 0.2, '#444')],
  },
  {
    id: 'cadeira-escritorio',
    name: 'Cadeira de escritório',
    category: 'Escritório',
    w: 60,
    d: 60,
    h: 110,
    color: '#2f3440',
    parts: [C(0, 0, 0, 0.4, 0.4, 0.04, DARK, 'metal'), C(0, 0.04, 0, 0.05, 0.05, 0.36, STEEL, 'metal'), B(0, 0.4, 0.02, 0.8, 0.07, 0.78, 'main', 'fabric'), B(0, 0.47, -0.38, 0.76, 0.5, 0.08, 'main', 'fabric')],
  },

  // ─── Área de serviço ────────────────────────────────────
  {
    id: 'maquina-lavar',
    name: 'Máquina de lavar',
    category: 'Área de serviço',
    w: 60,
    d: 65,
    h: 100,
    color: '#f2f3f5',
    parts: [B(0, 0, 0, 1, 1, 1, 'main', 'metal'), C(0, 0.995, 0.05, 0.36, 0.32, 0.01, '#9aa3ad', 'glass'), B(0, 0.9, -0.44, 1, 0.1, 0.1, '#dcdfe3')],
  },
  {
    id: 'tanque',
    name: 'Tanque',
    category: 'Área de serviço',
    w: 60,
    d: 55,
    h: 85,
    color: '#e9e9e9',
    parts: [B(0, 0.55, 0, 1, 0.45, 1), B(0, 0.75, 0.05, 0.8, 0.26, 0.75, '#d0d4d8'), C(0, 0, 0, 0.12, 0.12, 0.55)],
  },

  // ─── Decoração ──────────────────────────────────────────
  {
    id: 'tapete',
    name: 'Tapete',
    category: 'Decoração',
    w: 200,
    d: 140,
    h: 1,
    color: '#b85f4a',
    parts: [B(0, 0, 0, 1, 1, 1, 'main', 'fabric'), B(0, 0.5, 0, 0.85, 0.6, 0.8, '#e7d2b5', 'fabric')],
  },
  {
    id: 'tapete-redondo',
    name: 'Tapete redondo',
    category: 'Decoração',
    w: 150,
    d: 150,
    h: 1,
    color: '#5f7d6e',
    parts: [C(0, 0, 0, 0.5, 0.5, 1, 'main', 'fabric')],
  },
  {
    id: 'planta',
    name: 'Vaso com planta',
    category: 'Decoração',
    w: 50,
    d: 50,
    h: 120,
    color: '#4f8a4b',
    parts: [C(0, 0, 0, 0.32, 0.32, 0.3, '#c9a27a'), C(0, 0.3, 0, 0.5, 0.5, 0.5, 'main'), C(0, 0.6, 0, 0.36, 0.36, 0.4, 'main')],
  },
  {
    id: 'luminaria',
    name: 'Luminária de piso',
    category: 'Decoração',
    w: 40,
    d: 40,
    h: 160,
    color: '#f2e3c2',
    parts: [C(0, 0, 0, 0.45, 0.45, 0.02, DARK, 'metal'), C(0, 0.02, 0, 0.04, 0.04, 0.8, DARK, 'metal'), C(0, 0.8, 0, 0.5, 0.5, 0.2, 'main', 'fabric')],
  },
];

// Mesas de jantar recebem as cadeiras como parte do conjunto
for (const item of CATALOG) {
  if (item.id === 'mesa-4' || item.id === 'mesa-6') {
    const per = item.id === 'mesa-4' ? 2 : 3;
    const cw = 0.3;
    const chairs: Part[] = [];
    for (let i = 0; i < per; i++) {
      const x = -0.5 + (i + 0.5) / per;
      for (const side of [-1, 1]) {
        chairs.push(B(x, 0, side * 0.62, cw, 0.6, 0.45, WOOD));
        chairs.push(B(x, 0.6, side * 0.82, cw, 0.6, 0.06, WOOD));
      }
    }
    item.parts.push(...chairs);
  }
}

export const CATALOG_BY_ID: Record<string, CatalogItem> = Object.fromEntries(CATALOG.map((i) => [i.id, i]));

export function partColor(c: PartColor, main: string) {
  return c === 'main' ? main : c;
}

export { WOOD, WHITE };
