import { describe, expect, it } from 'vitest';
import {
  clampOpening,
  cm2ToM2,
  parseLength,
  pointInPolygon,
  polygonArea,
  polygonCentroid,
  snapAngle,
  snapToGrid,
  wallCorners,
  wallPieces,
} from './geometry';
import type { Wall } from './types';

const wall = (id: string, ax: number, ay: number, bx: number, by: number, t = 15): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thickness: t,
  height: 280,
  color: '#fff',
});

describe('área e polígonos', () => {
  it('cômodo 4 × 3 m tem 12 m²', () => {
    const rect = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 300 },
      { x: 0, y: 300 },
    ];
    expect(cm2ToM2(polygonArea(rect))).toBeCloseTo(12);
    expect(polygonCentroid(rect)).toEqual({ x: 200, y: 150 });
    expect(pointInPolygon({ x: 10, y: 10 }, rect)).toBe(true);
    expect(pointInPolygon({ x: 500, y: 10 }, rect)).toBe(false);
  });

  it('área independe do sentido', () => {
    const l = [
      { x: 0, y: 0 },
      { x: 0, y: 200 },
      { x: 200, y: 200 },
      { x: 200, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
    ];
    expect(polygonArea(l)).toBeCloseTo(30000);
    expect(polygonArea([...l].reverse())).toBeCloseTo(30000);
  });
});

describe('snap', () => {
  it('grade', () => {
    expect(snapToGrid({ x: 12, y: 27 }, 10)).toEqual({ x: 10, y: 30 });
  });
  it('ângulo 45°', () => {
    const p = snapAngle({ x: 0, y: 0 }, { x: 100, y: 8 });
    expect(p.x).toBeCloseTo(Math.hypot(100, 8));
    expect(p.y).toBeCloseTo(0);
  });
});

describe('medidas digitadas', () => {
  it('interpreta metros e centímetros', () => {
    expect(parseLength('3,45')).toBeCloseTo(345);
    expect(parseLength('3.45m')).toBeCloseTo(345);
    expect(parseLength('80cm')).toBe(80);
    expect(parseLength('abc')).toBeNull();
  });
});

describe('aberturas', () => {
  it('fica dentro da parede', () => {
    expect(clampOpening(10, 80, 300, [])).toBe(40);
    expect(clampOpening(290, 80, 300, [])).toBe(260);
    expect(clampOpening(150, 80, 300, [])).toBe(150);
  });
  it('não cabe', () => {
    expect(clampOpening(50, 120, 100, [])).toBeNull();
  });
  it('não sobrepõe outra', () => {
    expect(clampOpening(100, 80, 400, [{ offset: 150, width: 80 }])).toBeNull();
    expect(clampOpening(60, 80, 400, [{ offset: 150, width: 80 }])).toBe(60);
  });
});

describe('divisão da parede para o 3D', () => {
  it('sem aberturas = um bloco', () => {
    expect(wallPieces(300, 280, [])).toEqual([{ u0: 0, u1: 300, y0: 0, y1: 280 }]);
  });
  it('janela gera 4 blocos', () => {
    const p = wallPieces(300, 280, [{ offset: 150, width: 100, sill: 100, height: 120 }]);
    expect(p).toEqual([
      { u0: 0, u1: 100, y0: 0, y1: 280 },
      { u0: 100, u1: 200, y0: 0, y1: 100 },
      { u0: 100, u1: 200, y0: 220, y1: 280 },
      { u0: 200, u1: 300, y0: 0, y1: 280 },
    ]);
  });
  it('porta no piso não gera bloco abaixo', () => {
    const p = wallPieces(300, 280, [{ offset: 50, width: 80, sill: 0, height: 210 }]);
    expect(p).toEqual([
      { u0: 0, u1: 10, y0: 0, y1: 280 },
      { u0: 10, u1: 90, y0: 210, y1: 280 },
      { u0: 90, u1: 300, y0: 0, y1: 280 },
    ]);
  });
  it('vão do piso ao teto não gera bloco no meio', () => {
    const p = wallPieces(300, 280, [{ offset: 150, width: 100, sill: 0, height: 280 }]);
    expect(p).toHaveLength(2);
  });
});

describe('esquadria nos cantos', () => {
  it('canto em L fecha certinho', () => {
    const w1 = wall('1', 0, 0, 400, 0);
    const w2 = wall('2', 400, 0, 400, 300);
    const c1 = wallCorners(w1, [w1, w2]);
    const c2 = wallCorners(w2, [w1, w2]);
    // n de w1 = (0,1): lado L é y=+7.5 (interno), R é y=-7.5 (externo)
    expect(c1.bL.x).toBeCloseTo(392.5);
    expect(c1.bL.y).toBeCloseTo(7.5);
    expect(c1.bR.x).toBeCloseTo(407.5);
    expect(c1.bR.y).toBeCloseTo(-7.5);
    // os cantos coincidem com os da parede vizinha
    const pts2 = [c2.aL, c2.aR].map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).sort();
    const pts1 = [c1.bL, c1.bR].map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).sort();
    expect(pts2).toEqual(pts1);
  });
  it('parede solta tem ponta reta', () => {
    const w = wall('1', 0, 0, 100, 0);
    const c = wallCorners(w, [w]);
    expect(c.aL).toEqual({ x: 0, y: 7.5 });
    expect(c.aR).toEqual({ x: 0, y: -7.5 });
  });
});
