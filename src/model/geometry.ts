import type { Opening, Vec2, Wall } from './types';

export const EPS = 0.01;

export const v = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;
export const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x;
export const len = (a: Vec2) => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a: Vec2): Vec2 => {
  const l = len(a);
  return l < 1e-9 ? { x: 1, y: 0 } : { x: a.x / l, y: a.y / l };
};
/** perpendicular (rotação de +90° no sistema de tela) */
export const perp = (a: Vec2): Vec2 => ({ x: -a.y, y: a.x });
export const samePoint = (a: Vec2, b: Vec2, eps = 0.5) => dist(a, b) <= eps;
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export const round = (n: number, step = 0.1) => Math.round(n / step) * step;

export function snapToGrid(p: Vec2, grid: number): Vec2 {
  return { x: Math.round(p.x / grid) * grid, y: Math.round(p.y / grid) * grid };
}

/** Restringe o ponto `p` a direções múltiplas de 45° a partir de `origin`. */
export function snapAngle(origin: Vec2, p: Vec2, stepDeg = 45): Vec2 {
  const d = sub(p, origin);
  const l = len(d);
  const step = (stepDeg * Math.PI) / 180;
  const ang = Math.round(Math.atan2(d.y, d.x) / step) * step;
  return { x: origin.x + Math.cos(ang) * l, y: origin.y + Math.sin(ang) * l };
}

export function wallLength(w: Pick<Wall, 'a' | 'b'>) {
  return dist(w.a, w.b);
}

export function wallDir(w: Pick<Wall, 'a' | 'b'>) {
  return norm(sub(w.b, w.a));
}

/** Projeção de p no segmento ab: t ∈ [0,1], ponto mais próximo e distância. */
export function projectOnSegment(p: Vec2, a: Vec2, b: Vec2) {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  let t = l2 < 1e-9 ? 0 : dot(sub(p, a), ab) / l2;
  t = Math.max(0, Math.min(1, t));
  const point = lerp(a, b, t);
  return { t, point, dist: dist(p, point), along: t * Math.sqrt(l2) };
}

/** Interseção das retas p1 + s·d1 e p2 + r·d2. */
export function lineIntersect(p1: Vec2, d1: Vec2, p2: Vec2, d2: Vec2): Vec2 | null {
  const c = cross(d1, d2);
  if (Math.abs(c) < 1e-6) return null;
  const s = cross(sub(p2, p1), d2) / c;
  return add(p1, scale(d1, s));
}

/** Área de polígono (fórmula do laço) em cm², sempre positiva. */
export function polygonArea(poly: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s) / 2;
}

export const cm2ToM2 = (a: number) => a / 10000;

export function polygonCentroid(poly: Vec2[]): Vec2 {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const f = p.x * q.y - q.x * p.y;
    a += f;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  if (Math.abs(a) < 1e-9) {
    const n = poly.length || 1;
    return { x: poly.reduce((s, p) => s + p.x, 0) / n, y: poly.reduce((s, p) => s + p.y, 0) / n };
  }
  a /= 2;
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function polygonPerimeter(poly: Vec2[]) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) s += dist(poly[i], poly[(i + 1) % poly.length]);
  return s;
}

/** Outras paredes conectadas a uma extremidade, com a direção "saindo" do ponto. */
function neighborsAt(wall: Wall, end: 'a' | 'b', walls: Wall[]) {
  const p = wall[end];
  const out: { wall: Wall; dir: Vec2 }[] = [];
  for (const w of walls) {
    if (w.id === wall.id) continue;
    if (samePoint(w.a, p)) out.push({ wall: w, dir: wallDir(w) });
    else if (samePoint(w.b, p)) out.push({ wall: w, dir: scale(wallDir(w), -1) });
  }
  return out;
}

export interface WallCorners {
  /** lado +n (esquerda em relação a a→b no sistema de tela) */
  aL: Vec2;
  bL: Vec2;
  /** lado -n */
  aR: Vec2;
  bR: Vec2;
}

/**
 * Cantos da parede com junção em esquadria quando exatamente duas paredes
 * se encontram num nó. Em nós com 3+ paredes, a ponta fica reta.
 */
export function wallCorners(wall: Wall, walls: Wall[]): WallCorners {
  const d = wallDir(wall);
  const n = perp(d);
  const h = wall.thickness / 2;
  const L = wallLength(wall);
  const res: WallCorners = {
    aL: add(wall.a, scale(n, h)),
    aR: add(wall.a, scale(n, -h)),
    bL: add(wall.b, scale(n, h)),
    bR: add(wall.b, scale(n, -h)),
  };
  const maxMiter = Math.max(wall.thickness * 3, 10);

  for (const end of ['a', 'b'] as const) {
    const nb = neighborsAt(wall, end, walls);
    if (nb.length !== 1) continue;
    const p = wall[end];
    // direção "saindo" do nó para esta parede
    const dOut = end === 'a' ? d : scale(d, -1);
    const nOut = perp(dOut);
    const o = nb[0];
    const n2 = perp(o.dir);
    const h2 = o.wall.thickness / 2;
    // lado +nOut desta parede encontra o lado -n2 da vizinha e vice-versa
    const plus = lineIntersect(add(p, scale(nOut, h)), dOut, add(p, scale(n2, -h2)), o.dir);
    const minus = lineIntersect(add(p, scale(nOut, -h)), dOut, add(p, scale(n2, h2)), o.dir);
    if (!plus || !minus) continue;
    if (dist(plus, p) > maxMiter || dist(minus, p) > maxMiter) continue;
    // não deixa a esquadria passar da outra ponta
    const along = (q: Vec2) => dot(sub(q, wall.a), d);
    if (along(plus) > L + maxMiter || along(minus) < -maxMiter) continue;
    // nOut = n quando end='a'; nOut = -n quando end='b'
    if (end === 'a') {
      res.aL = plus;
      res.aR = minus;
    } else {
      res.bR = plus;
      res.bL = minus;
    }
  }
  return res;
}

export function wallPolygon(wall: Wall, walls: Wall[]): Vec2[] {
  const c = wallCorners(wall, walls);
  return [c.aL, c.bL, c.bR, c.aR];
}

/** Ponto da parede a uma distância `u` de `a`, deslocado `side` na normal. */
export function pointOnWall(wall: Pick<Wall, 'a' | 'b'>, u: number, side = 0): Vec2 {
  const d = wallDir(wall);
  return add(add(wall.a, scale(d, u)), scale(perp(d), side));
}

export function wallAngleDeg(wall: Pick<Wall, 'a' | 'b'>) {
  const d = sub(wall.b, wall.a);
  return (Math.atan2(d.y, d.x) * 180) / Math.PI;
}

/**
 * Ajusta a posição (centro) de uma abertura para ficar dentro da parede.
 * Retorna null se não couber ou se sobrepor outra abertura.
 */
export function clampOpening(
  center: number,
  width: number,
  wallLen: number,
  others: Pick<Opening, 'offset' | 'width'>[],
  margin = 0,
): number | null {
  const half = width / 2;
  if (width + 2 * margin > wallLen + EPS) return null;
  const c = Math.max(half + margin, Math.min(wallLen - half - margin, center));
  for (const o of others) {
    if (Math.abs(o.offset - c) < o.width / 2 + half - EPS) return null;
  }
  return c;
}

export interface WallPiece {
  u0: number;
  u1: number;
  y0: number;
  y1: number;
}

/** Divide a parede em blocos maciços em volta das aberturas (para o 3D). */
export function wallPieces(
  wallLen: number,
  wallHeight: number,
  openings: Pick<Opening, 'offset' | 'width' | 'sill' | 'height'>[],
): WallPiece[] {
  const ops = [...openings]
    .map((o) => ({
      u0: Math.max(0, o.offset - o.width / 2),
      u1: Math.min(wallLen, o.offset + o.width / 2),
      y0: Math.max(0, o.sill),
      y1: Math.min(wallHeight, o.sill + o.height),
    }))
    .filter((o) => o.u1 > o.u0 + EPS)
    .sort((p, q) => p.u0 - q.u0);
  const pieces: WallPiece[] = [];
  let cursor = 0;
  for (const o of ops) {
    if (o.u0 > cursor + EPS) pieces.push({ u0: cursor, u1: o.u0, y0: 0, y1: wallHeight });
    if (o.y0 > EPS) pieces.push({ u0: o.u0, u1: o.u1, y0: 0, y1: o.y0 });
    if (o.y1 < wallHeight - EPS) pieces.push({ u0: o.u0, u1: o.u1, y0: o.y1, y1: wallHeight });
    cursor = Math.max(cursor, o.u1);
  }
  if (cursor < wallLen - EPS) pieces.push({ u0: cursor, u1: wallLen, y0: 0, y1: wallHeight });
  return pieces;
}

/** Contorno (planta) de um trecho [u0,u1] da parede respeitando a esquadria nas pontas. */
export function wallSliceQuad(wall: Wall, corners: WallCorners, u0: number, u1: number): Vec2[] {
  const L = wallLength(wall);
  const h = wall.thickness / 2;
  const s0L = u0 <= EPS ? corners.aL : pointOnWall(wall, u0, h);
  const s0R = u0 <= EPS ? corners.aR : pointOnWall(wall, u0, -h);
  const s1L = u1 >= L - EPS ? corners.bL : pointOnWall(wall, u1, h);
  const s1R = u1 >= L - EPS ? corners.bR : pointOnWall(wall, u1, -h);
  return [s0L, s1L, s1R, s0R];
}

export function boundsOf(points: Vec2[]) {
  if (!points.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

/** Cantos do retângulo de um móvel (centro, rotação em graus). */
export function rectCorners(cx: number, cy: number, w: number, d: number, rotDeg: number): Vec2[] {
  const r = (rotDeg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ].map(([x, y]) => ({ x: cx + x * c - y * s, y: cy + x * s + y * c }));
}

/** Formata cm como metros: 345 → "3,45 m" */
export function fmtM(cm: number, digits = 2) {
  return `${(cm / 100).toFixed(digits).replace('.', ',')} m`;
}

export function fmtM2(cm2: number) {
  return `${cm2ToM2(cm2).toFixed(2).replace('.', ',')} m²`;
}

/** Interpreta "3,45", "3.45m", "345cm" → centímetros */
export function parseLength(input: string): number | null {
  const s = input.trim().toLowerCase().replace(',', '.');
  const m = s.match(/^(-?\d*\.?\d+)\s*(cm|m)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!isFinite(n)) return null;
  if (m[2] === 'cm') return n;
  return n * 100;
}

let idCounter = 0;
export function uid(prefix = 'id') {
  idCounter = (idCounter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
