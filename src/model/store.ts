import { create } from 'zustand';
import type { EntityKind, Floor, Furniture, Project, Selection, Tool, Vec2, ViewMode } from './types';
import { add, clampOpening, samePoint, uid, wallLength } from './geometry';
import { CATALOG_BY_ID } from '../catalog/items';

const HISTORY_LIMIT = 150;

export function newFloor(name: string, elevation: number, height = 280): Floor {
  return { id: uid('floor'), name, elevation, height, walls: [], openings: [], rooms: [], furniture: [], dimensions: [] };
}

export function newProject(name = 'Meu projeto'): Project {
  return {
    id: uid('proj'),
    name,
    version: 1,
    floors: [newFloor('Térreo', 0)],
    settings: { gridCm: 10, snap: true, wallHeight: 280, wallThickness: 15 },
    updatedAt: Date.now(),
  };
}

export interface UIState {
  project: Project;
  floorId: string;
  selection: Selection | null;
  tool: Tool;
  viewMode: ViewMode;
  pendingCatalogId: string | null;
  roomCreatesWalls: boolean;
  showAllFloors: boolean;
  firstPerson: boolean;
  past: Project[];
  future: Project[];
  clipboard: Furniture | null;
  rightTab: 'props' | 'catalog' | 'summary';
  /** snapshot tirado no início de um arraste */
  dragBase: Project | null;
  toast: string | null;
  fitNonce: number;
}

export interface Actions {
  loadProject(p: Project): void;
  /** aplica uma alteração registrando no histórico */
  commit(fn: (p: Project, floor: Floor) => void): void;
  /** inicia uma alteração contínua (arraste): um único passo de desfazer */
  beginDrag(): Project;
  /** aplica fn sobre uma cópia do snapshot inicial do arraste */
  dragUpdate(fn: (p: Project, floor: Floor) => void): void;
  endDrag(): void;
  cancelDrag(): void;
  undo(): void;
  redo(): void;
  setTool(t: Tool): void;
  select(s: Selection | null): void;
  setViewMode(m: ViewMode): void;
  setFloor(id: string): void;
  setPendingCatalog(id: string | null): void;
  set<K extends keyof UIState>(key: K, value: UIState[K]): void;
  deleteSelection(): void;
  copySelection(): void;
  paste(): void;
  rotateSelection(deg: number): void;
}

export type Store = UIState & Actions;

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function showToast(msg: string) {
  useStore.setState({ toast: msg });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => useStore.setState({ toast: null }), 2600);
}

export const clone = <T,>(x: T): T => structuredClone(x);

export function currentFloor(p: Project, floorId: string): Floor {
  return p.floors.find((f) => f.id === floorId) ?? p.floors[0];
}

const initial = newProject();

export const useStore = create<Store>((set, get) => ({
  project: initial,
  floorId: initial.floors[0].id,
  selection: null,
  tool: 'select',
  viewMode: 'split',
  pendingCatalogId: null,
  roomCreatesWalls: true,
  showAllFloors: true,
  firstPerson: false,
  past: [],
  future: [],
  clipboard: null,
  rightTab: 'catalog',
  dragBase: null,
  toast: null,
  fitNonce: 0,

  loadProject(p) {
    set((s) => ({ project: p, floorId: p.floors[0].id, selection: null, past: [], future: [], dragBase: null, tool: 'select', fitNonce: s.fitNonce + 1 }));
  },

  commit(fn) {
    const { project, floorId, past } = get();
    const next = clone(project);
    fn(next, currentFloor(next, floorId));
    next.updatedAt = Date.now();
    set({ project: next, past: [...past, project].slice(-HISTORY_LIMIT), future: [] });
  },

  beginDrag() {
    const base = get().project;
    set({ dragBase: base });
    return base;
  },

  dragUpdate(fn) {
    const { dragBase, floorId } = get();
    if (!dragBase) return;
    const next = clone(dragBase);
    fn(next, currentFloor(next, floorId));
    next.updatedAt = Date.now();
    set({ project: next });
  },

  endDrag() {
    const { dragBase, project, past } = get();
    if (!dragBase) return;
    if (dragBase !== project) {
      fixOpenings(project);
      set({ past: [...past, dragBase].slice(-HISTORY_LIMIT), future: [], dragBase: null, project: { ...project } });
    } else set({ dragBase: null });
  },

  cancelDrag() {
    const { dragBase } = get();
    if (dragBase) set({ project: dragBase, dragBase: null });
  },

  undo() {
    const { past, project, future, floorId } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    set({
      project: prev,
      past: past.slice(0, -1),
      future: [project, ...future].slice(0, HISTORY_LIMIT),
      selection: null,
      floorId: prev.floors.some((f) => f.id === floorId) ? floorId : prev.floors[0].id,
    });
  },

  redo() {
    const { past, project, future, floorId } = get();
    if (!future.length) return;
    const next = future[0];
    set({
      project: next,
      past: [...past, project],
      future: future.slice(1),
      selection: null,
      floorId: next.floors.some((f) => f.id === floorId) ? floorId : next.floors[0].id,
    });
  },

  setTool(t) {
    set({ tool: t, ...(t !== 'furniture' ? { pendingCatalogId: null } : {}) });
  },
  select(s) {
    set({ selection: s, ...(s ? { rightTab: 'props' as const } : {}) });
  },
  setViewMode(m) {
    set({ viewMode: m, ...(m === '2d' ? { firstPerson: false } : {}) });
  },
  setFloor(id) {
    set({ floorId: id, selection: null });
  },
  setPendingCatalog(id) {
    set({ pendingCatalogId: id, tool: id ? 'furniture' : 'select' });
  },
  set(key, value) {
    set({ [key]: value } as Partial<UIState>);
  },

  deleteSelection() {
    const sel = get().selection;
    if (!sel) return;
    get().commit((_, f) => removeEntity(f, sel.kind, sel.id));
    set({ selection: null });
  },

  copySelection() {
    const { selection, project, floorId } = get();
    if (selection?.kind !== 'furniture') return;
    const f = currentFloor(project, floorId).furniture.find((x) => x.id === selection.id);
    if (f) set({ clipboard: clone(f) });
  },

  paste() {
    const { clipboard } = get();
    if (!clipboard) return;
    const id = uid('fur');
    const off = add(clipboard, { x: 30, y: 30 });
    get().commit((_, f) => f.furniture.push({ ...clone(clipboard), id, x: off.x, y: off.y }));
    set({ selection: { kind: 'furniture', id }, clipboard: { ...clipboard, x: off.x, y: off.y } });
  },

  rotateSelection(deg) {
    const sel = get().selection;
    if (sel?.kind !== 'furniture') return;
    get().commit((_, f) => {
      const it = f.furniture.find((x) => x.id === sel.id);
      if (it) it.rotation = (((it.rotation + deg) % 360) + 360) % 360;
    });
  },
}));

export function removeEntity(f: Floor, kind: EntityKind, id: string) {
  switch (kind) {
    case 'wall':
      f.walls = f.walls.filter((w) => w.id !== id);
      f.openings = f.openings.filter((o) => o.wallId !== id);
      break;
    case 'opening':
      f.openings = f.openings.filter((o) => o.id !== id);
      break;
    case 'room':
      f.rooms = f.rooms.filter((r) => r.id !== id);
      break;
    case 'furniture':
      f.furniture = f.furniture.filter((r) => r.id !== id);
      break;
    case 'dimension':
      f.dimensions = f.dimensions.filter((r) => r.id !== id);
      break;
  }
}

/** Garante que toda abertura caiba na sua parede (depois de mover/encurtar paredes). */
export function fixOpenings(p: Project) {
  for (const f of p.floors) {
    f.openings = f.openings.filter((o) => {
      const w = f.walls.find((x) => x.id === o.wallId);
      if (!w) return false;
      const L = wallLength(w);
      if (o.width > L) o.width = Math.max(20, L);
      o.offset = Math.max(o.width / 2, Math.min(L - o.width / 2, o.offset));
      if (o.sill + o.height > w.height) o.height = Math.max(10, w.height - o.sill);
      return true;
    });
  }
}

/** Move todos os nós (pontas de parede e vértices de cômodo) que estão em `from`. */
export function moveNode(f: Floor, from: Vec2, to: Vec2) {
  for (const w of f.walls) {
    if (samePoint(w.a, from)) w.a = { ...to };
    if (samePoint(w.b, from)) w.b = { ...to };
  }
  for (const r of f.rooms) {
    r.polygon = r.polygon.map((p) => (samePoint(p, from) ? { ...to } : p));
  }
}

export function makeFurniture(catalogId: string, x: number, y: number, rotation = 0): Furniture {
  const item = CATALOG_BY_ID[catalogId];
  return {
    id: uid('fur'),
    catalogId,
    x,
    y,
    rotation,
    w: item.w,
    d: item.d,
    h: item.h,
    elevation: item.elevation ?? 0,
    color: item.color,
  };
}

export const OPENING_DEFAULTS = {
  door: { width: 80, height: 210, sill: 0, color: '#b08a63' },
  window: { width: 120, height: 110, sill: 110, color: '#ffffff' },
  gap: { width: 90, height: 210, sill: 0, color: '#ffffff' },
} as const;

/** Tenta inserir abertura na parede; devolve id ou null se não couber. */
export function tryAddOpening(f: Floor, wallId: string, kind: 'door' | 'window' | 'gap', center: number): string | null {
  const w = f.walls.find((x) => x.id === wallId);
  if (!w) return null;
  const def = OPENING_DEFAULTS[kind];
  const others = f.openings.filter((o) => o.wallId === wallId);
  const c = clampOpening(center, def.width, wallLength(w), others);
  if (c == null) return null;
  const id = uid('op');
  f.openings.push({
    id,
    wallId,
    kind,
    offset: c,
    width: def.width,
    height: Math.min(def.height, w.height - def.sill),
    sill: def.sill,
    hinge: 'left',
    flip: false,
    color: def.color,
  });
  return id;
}
