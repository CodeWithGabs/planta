// Todas as medidas internas em centímetros. Plano 2D: x → direita, y → baixo.

export interface Vec2 {
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  a: Vec2;
  b: Vec2;
  thickness: number;
  height: number;
  color: string;
}

export type OpeningKind = 'door' | 'window' | 'gap';

export interface Opening {
  id: string;
  wallId: string;
  kind: OpeningKind;
  /** posição do centro da abertura ao longo da parede, medida a partir de `a` */
  offset: number;
  width: number;
  height: number;
  /** peitoril: altura da base da abertura em relação ao piso */
  sill: number;
  /** lado da dobradiça (portas) */
  hinge: 'left' | 'right';
  /** para qual lado da parede a porta abre */
  flip: boolean;
  color: string;
}

export type FloorMaterial = 'madeira' | 'ceramica' | 'porcelanato' | 'cimento' | 'carpete' | 'grama';

export interface Room {
  id: string;
  name: string;
  polygon: Vec2[];
  material: FloorMaterial;
}

export interface Furniture {
  id: string;
  catalogId: string;
  x: number;
  y: number;
  /** graus, sentido horário no plano */
  rotation: number;
  w: number;
  d: number;
  h: number;
  /** altura da base em relação ao piso (ex.: armário aéreo) */
  elevation: number;
  color: string;
}

export interface Dimension {
  id: string;
  a: Vec2;
  b: Vec2;
}

export interface Floor {
  id: string;
  name: string;
  /** altura do piso deste andar em relação ao térreo */
  elevation: number;
  height: number;
  walls: Wall[];
  openings: Opening[];
  rooms: Room[];
  furniture: Furniture[];
  dimensions: Dimension[];
}

export interface ProjectSettings {
  gridCm: number;
  snap: boolean;
  wallHeight: number;
  wallThickness: number;
}

export interface Project {
  id: string;
  name: string;
  version: 1;
  floors: Floor[];
  settings: ProjectSettings;
  updatedAt: number;
}

export type EntityKind = 'wall' | 'opening' | 'room' | 'furniture' | 'dimension';

export interface Selection {
  kind: EntityKind;
  id: string;
}

export type Tool =
  | 'select'
  | 'pan'
  | 'wall'
  | 'room'
  | 'roomPoly'
  | 'door'
  | 'window'
  | 'gap'
  | 'furniture'
  | 'dimension';

export type ViewMode = '2d' | '3d' | 'split';
