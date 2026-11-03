import type { FloorMaterial, Opening, Project, Vec2, Wall } from './types';
import { makeFurniture, newProject, OPENING_DEFAULTS } from './store';
import { uid } from './geometry';

type Seg = [number, number, number, number];
type Op = [wallIndex: number, kind: Opening['kind'], offset: number, width?: number, sill?: number, height?: number, flip?: boolean, hinge?: 'left' | 'right'];
type RoomDef = [name: string, material: FloorMaterial, poly: [number, number][]];
type FurnDef = [catalogId: string, x: number, y: number, rot?: number, color?: string];

function build(name: string, segs: Seg[], ops: Op[], rooms: RoomDef[], furn: FurnDef[]): Project {
  const p = newProject(name);
  const f = p.floors[0];
  const walls: Wall[] = segs.map(([ax, ay, bx, by]) => ({
    id: uid('wall'),
    a: { x: ax, y: ay },
    b: { x: bx, y: by },
    thickness: 15,
    height: 280,
    color: '#f2efe9',
  }));
  f.walls = walls;
  f.openings = ops.map(([wi, kind, offset, width, sill, height, flip, hinge]) => {
    const d = OPENING_DEFAULTS[kind];
    return {
      id: uid('op'),
      wallId: walls[wi].id,
      kind,
      offset,
      width: width ?? d.width,
      sill: sill ?? d.sill,
      height: height ?? d.height,
      hinge: hinge ?? 'left',
      flip: flip ?? false,
      color: d.color,
    };
  });
  f.rooms = rooms.map(([n, material, poly]) => ({
    id: uid('room'),
    name: n,
    material,
    polygon: poly.map(([x, y]): Vec2 => ({ x, y })),
  }));
  f.furniture = furn.map(([id, x, y, rot, color]) => {
    const it = makeFurniture(id, x, y, rot ?? 0);
    if (color) it.color = color;
    return it;
  });
  return p;
}

const rect = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

export function apartment2q(): Project {
  return build(
    'Apartamento 2 quartos',
    [
      [0, 0, 900, 0], // 0 topo
      [900, 0, 900, 700], // 1 direita
      [900, 700, 0, 700], // 2 baixo
      [0, 700, 0, 0], // 3 esquerda
      [350, 0, 350, 300], // 4 quarto 1 / cozinha
      [0, 300, 350, 300], // 5 quarto 1 / banho+corredor
      [0, 450, 350, 450], // 6 quarto 2 topo
      [350, 450, 350, 700], // 7 quarto 2 / sala
      [200, 300, 200, 450], // 8 banho / corredor
    ],
    [
      [5, 'door', 275, 80, 0, 210, true],
      [6, 'door', 275, 80, 0, 210, false],
      [8, 'door', 75, 70, 0, 210, true],
      [1, 'door', 330, 90, 0, 210, false],
      [0, 'window', 175, 150, 100, 120],
      [2, 'window', 725, 150, 100, 120],
      [2, 'window', 275, 200, 90, 130],
      [0, 'window', 620, 120, 110, 100],
      [3, 'window', 325, 60, 160, 50],
    ],
    [
      ['Quarto 1', 'madeira', rect(0, 0, 350, 300)],
      ['Banheiro', 'ceramica', rect(0, 300, 200, 450)],
      ['Corredor', 'madeira', rect(200, 300, 350, 450)],
      ['Quarto 2', 'madeira', rect(0, 450, 350, 700)],
      ['Cozinha', 'porcelanato', rect(350, 0, 900, 250)],
      ['Sala', 'madeira', rect(350, 250, 900, 700)],
    ],
    [
      ['cama-casal', 107, 150, 270],
      ['criado-mudo', 27.5, 50, 270],
      ['criado-mudo', 27.5, 250, 270],
      ['guarda-roupa', 315, 100, 90],
      ['vaso', 42, 410, 270],
      ['pia-banheiro', 60, 332, 0],
      ['cama-solteiro', 106, 600, 270],
      ['escrivaninha', 312, 600, 90],
      ['cadeira-escritorio', 262, 600, 270],
      ['armario-cozinha', 500, 37.5, 0],
      ['pia-cozinha', 620, 37.5, 0],
      ['fogao', 717, 38.5, 0],
      ['geladeira', 850, 43.5, 0],
      ['armario-aereo', 500, 25, 0],
      ['mesa-4', 520, 170, 0],
      ['tapete', 690, 530, 90],
      ['sofa-3', 530, 530, 270],
      ['mesa-centro', 690, 530, 90],
      ['rack', 870, 530, 90],
      ['planta', 400, 660, 0],
    ],
  );
}

export function houseSingleStory(): Project {
  return build(
    'Casa térrea 3 quartos',
    [
      [0, 0, 1200, 0], // 0 topo
      [1200, 0, 1200, 800], // 1 direita
      [1200, 800, 0, 800], // 2 baixo
      [0, 800, 0, 0], // 3 esquerda
      [380, 0, 380, 380], // 4 q1 / q2
      [0, 380, 760, 380], // 5 quartos / circulação
      [760, 0, 760, 380], // 6 q2 / banho
      [760, 240, 960, 240], // 7 banho / circulação
      [960, 0, 960, 480], // 8 banho+circ / cozinha
    ],
    [
      [5, 'door', 190, 80, 0, 210, true],
      [5, 'door', 570, 80, 0, 210, true],
      [7, 'door', 100, 70, 0, 210, true],
      [8, 'gap', 360, 100, 0, 220],
      [2, 'door', 650, 100, 0, 220, false],
      [0, 'window', 190, 150, 100, 120],
      [0, 'window', 570, 150, 100, 120],
      [0, 'window', 860, 60, 160, 50],
      [1, 'window', 240, 120, 110, 100],
      [2, 'window', 250, 200, 90, 130],
      [2, 'window', 1000, 240, 0, 220],
    ],
    [
      ['Quarto 1', 'madeira', rect(0, 0, 380, 380)],
      ['Quarto 2 (suíte)', 'madeira', rect(380, 0, 760, 380)],
      ['Banheiro', 'ceramica', rect(760, 0, 960, 240)],
      [
        'Circulação',
        'porcelanato',
        [
          [0, 380],
          [760, 380],
          [760, 240],
          [960, 240],
          [960, 480],
          [0, 480],
        ],
      ],
      ['Cozinha', 'porcelanato', rect(960, 0, 1200, 480)],
      ['Sala de estar e jantar', 'madeira', rect(0, 480, 1200, 800)],
    ],
    [
      ['cama-casal', 106, 190, 270],
      ['criado-mudo', 27.5, 90, 270],
      ['guarda-roupa', 345, 150, 90],
      ['cama-queen', 648, 190, 90],
      ['criado-mudo', 732, 80, 90],
      ['criado-mudo', 732, 300, 90],
      ['guarda-roupa-grande', 417, 190, 270],
      ['box', 907, 52, 0],
      ['vaso', 790, 41.5, 0],
      ['pia-banheiro', 791.5, 150, 270],
      ['geladeira', 1156, 50, 90],
      ['pia-cozinha', 1162, 240, 90],
      ['fogao', 1161, 345, 90],
      ['mesa-redonda', 1070, 360, 0],
      ['rack', 30, 640, 270],
      ['tapete', 200, 640, 90],
      ['mesa-centro', 200, 640, 90],
      ['sofa-3', 380, 640, 90],
      ['mesa-6', 800, 640, 0],
      ['planta', 1150, 750, 0],
      ['luminaria', 440, 530, 0],
    ],
  );
}

export function simpleRoom(): Project {
  return build(
    'Cômodo 4 × 3 m',
    [
      [0, 0, 400, 0],
      [400, 0, 400, 300],
      [400, 300, 0, 300],
      [0, 300, 0, 0],
    ],
    [
      [2, 'door', 320, 80, 0, 210],
      [0, 'window', 200, 150, 100, 120],
    ],
    [['Quarto', 'madeira', rect(0, 0, 400, 300)]],
    [],
  );
}

export const TEMPLATES = [
  { id: 'apto', name: 'Apartamento 2 quartos', desc: '9 × 7 m · 6 ambientes mobiliados', make: apartment2q },
  { id: 'casa', name: 'Casa térrea 3 quartos', desc: '12 × 8 m · suíte, cozinha e sala integradas', make: houseSingleStory },
  { id: 'comodo', name: 'Cômodo 4 × 3 m', desc: 'Um quarto vazio com porta e janela', make: simpleRoom },
];
