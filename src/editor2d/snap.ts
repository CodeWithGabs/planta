import type { Floor, Vec2 } from '../model/types';
import { dist, projectOnSegment, snapAngle, snapToGrid, sub } from '../model/geometry';

export interface SnapResult {
  p: Vec2;
  kind: 'node' | 'wall' | 'grid' | 'free';
}

export interface SnapOpts {
  floor: Floor;
  grid: number;
  gridOn: boolean;
  /** pixels → cm (1 / escala) */
  pxToCm: number;
  origin?: Vec2 | null;
  lockAngle?: boolean;
  /** pontos extras que também atraem (ex.: pontos da cadeia sendo desenhada) */
  extra?: Vec2[];
  /** ignora nós iguais a estes (ex.: o próprio nó sendo arrastado) */
  exclude?: Vec2[];
}

export function nodesOf(floor: Floor): Vec2[] {
  const pts: Vec2[] = [];
  for (const w of floor.walls) pts.push(w.a, w.b);
  for (const r of floor.rooms) pts.push(...r.polygon);
  return pts;
}

export function snapPoint(raw: Vec2, o: SnapOpts): SnapResult {
  const nodeR = 10 * o.pxToCm;
  const wallR = 7 * o.pxToCm;
  const excluded = (q: Vec2) => o.exclude?.some((e) => dist(e, q) < 0.5);

  // 1. ângulo travado (Shift) a partir da origem
  let p = raw;
  if (o.origin && o.lockAngle) p = snapAngle(o.origin, raw, 45);

  // 2. nós existentes
  let best: Vec2 | null = null;
  let bestD = nodeR;
  for (const q of [...nodesOf(o.floor), ...(o.extra ?? [])]) {
    if (excluded(q)) continue;
    const d = dist(q, p);
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  if (best) return { p: { ...best }, kind: 'node' };

  // 3. sobre o eixo de uma parede
  if (!o.lockAngle) {
    let bw: Vec2 | null = null;
    let bwd = wallR;
    for (const w of o.floor.walls) {
      if (excluded(w.a) && excluded(w.b)) continue;
      const pr = projectOnSegment(p, w.a, w.b);
      if (pr.dist < bwd) {
        bwd = pr.dist;
        bw = pr.point;
      }
    }
    if (bw) return { p: { x: Math.round(bw.x * 10) / 10, y: Math.round(bw.y * 10) / 10 }, kind: 'wall' };
  }

  // 4. alinhamento automático 0°/90° quando quase reto
  if (o.origin && !o.lockAngle) {
    const d = sub(p, o.origin);
    const tol = 6 * o.pxToCm;
    if (Math.abs(d.y) < tol && Math.abs(d.x) > tol) p = { x: p.x, y: o.origin.y };
    else if (Math.abs(d.x) < tol && Math.abs(d.y) > tol) p = { x: o.origin.x, y: p.y };
  }

  // 5. grade
  if (o.gridOn) {
    const g = snapToGrid(p, o.grid);
    // mantém o eixo alinhado com a origem
    if (o.origin && p.x === o.origin.x) g.x = p.x;
    if (o.origin && p.y === o.origin.y) g.y = p.y;
    if (o.origin && o.lockAngle) {
      // com ângulo travado, arredonda só o comprimento
      const L = Math.round(dist(o.origin, p) / o.grid) * o.grid;
      const d = sub(p, o.origin);
      const l = Math.hypot(d.x, d.y) || 1;
      return { p: { x: o.origin.x + (d.x / l) * L, y: o.origin.y + (d.y / l) * L }, kind: 'grid' };
    }
    return { p: g, kind: 'grid' };
  }
  return { p: { x: Math.round(p.x), y: Math.round(p.y) }, kind: 'free' };
}

/** Parede mais próxima do ponto (para portas/janelas). */
export function nearestWall(floor: Floor, p: Vec2, maxDist: number) {
  let best: { wallId: string; along: number; dist: number } | null = null;
  for (const w of floor.walls) {
    const pr = projectOnSegment(p, w.a, w.b);
    const lim = w.thickness / 2 + maxDist;
    if (pr.dist <= lim && (!best || pr.dist < best.dist)) best = { wallId: w.id, along: pr.along, dist: pr.dist };
  }
  return best;
}
