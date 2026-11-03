import { boundsOf, rectCorners } from '../model/geometry';
import type { Floor } from '../model/types';
import { nodesOf } from './snap';
import { downloadBlob, slug } from '../model/persistence';

const STYLE = `.halo{paint-order:stroke;stroke:#fff;stroke-linejoin:round} text{font-family:Inter,system-ui,sans-serif}`;

/** Gera um SVG independente da planta, enquadrado no conteúdo. */
export function planSvgString(floor: Floor, title: string): { svg: string; w: number; h: number } | null {
  const el = document.getElementById('plan-svg') as SVGSVGElement | null;
  if (!el) return null;
  const pts = [...nodesOf(floor), ...floor.furniture.flatMap((f) => rectCorners(f.x, f.y, f.w, f.d, f.rotation))];
  if (!pts.length) return null;
  const b = boundsOf(pts);
  const m = 80;
  const vx = b.minX - m;
  const vy = b.minY - m - 40;
  const vw = b.maxX - b.minX + 2 * m;
  const vh = b.maxY - b.minY + 2 * m + 40;
  const clone = el.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('.no-export').forEach((n) => n.remove());
  clone.removeAttribute('style');
  clone.removeAttribute('id');
  clone.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
  const pxPerCm = Math.min(3, 3000 / Math.max(vw, vh));
  const w = Math.round(vw * pxPerCm);
  const h = Math.round(vh * pxPerCm);
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  const ns = 'http://www.w3.org/2000/svg';
  const style = document.createElementNS(ns, 'style');
  style.textContent = STYLE;
  clone.insertBefore(style, clone.firstChild);
  const bg = document.createElementNS(ns, 'rect');
  bg.setAttribute('x', String(vx));
  bg.setAttribute('y', String(vy));
  bg.setAttribute('width', String(vw));
  bg.setAttribute('height', String(vh));
  bg.setAttribute('fill', '#ffffff');
  clone.insertBefore(bg, style.nextSibling);
  const t = document.createElementNS(ns, 'text');
  t.setAttribute('x', String(vx + 20));
  t.setAttribute('y', String(vy + 40));
  t.setAttribute('font-size', '26');
  t.setAttribute('font-weight', '700');
  t.setAttribute('fill', '#222');
  t.textContent = title;
  clone.appendChild(t);
  let svg = new XMLSerializer().serializeToString(clone);
  svg = svg.replace(/var\(--accent\)/g, '#2f6fed');
  return { svg, w, h };
}

export function exportPlanSvg(floor: Floor, name: string) {
  const r = planSvgString(floor, `${name} — ${floor.name}`);
  if (!r) return false;
  downloadBlob(new Blob([r.svg], { type: 'image/svg+xml' }), `${slug(name)}-${slug(floor.name)}.svg`);
  return true;
}

export async function exportPlanPng(floor: Floor, name: string) {
  const r = planSvgString(floor, `${name} — ${floor.name}`);
  if (!r) return false;
  const url = URL.createObjectURL(new Blob([r.svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('falha ao rasterizar'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = r.w;
    canvas.height = r.h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, r.w, r.h);
    ctx.drawImage(img, 0, 0, r.w, r.h);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (blob) downloadBlob(blob, `${slug(name)}-${slug(floor.name)}.png`);
    return !!blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function export3dPng(name: string) {
  const canvas = document.querySelector('.view3d canvas') as HTMLCanvasElement | null;
  if (!canvas) return false;
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (blob) downloadBlob(blob, `${slug(name)}-3d.png`);
  return !!blob;
}
