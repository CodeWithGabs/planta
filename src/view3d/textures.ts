import * as THREE from 'three';
import type { FloorMaterial } from '../model/types';

/** Texturas procedurais (canvas), uma "telha" = 1 m × 1 m. */
const cache = new Map<FloorMaterial, THREE.Texture>();

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function noise(ctx: CanvasRenderingContext2D, size: number, amount: number, r: () => number) {
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * amount;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function draw(kind: FloorMaterial): HTMLCanvasElement {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const r = rand(kind.length * 977 + 13);
  switch (kind) {
    case 'madeira': {
      // tábuas de 20 cm × 1 m, emendas desencontradas
      const rows = 5;
      const h = S / rows;
      for (let i = 0; i < rows; i++) {
        const shift = r() * S;
        for (let k = -1; k < 2; k++) {
          const tone = 150 + r() * 40;
          ctx.fillStyle = `rgb(${tone + 40},${tone - 5},${tone - 55})`;
          ctx.fillRect(shift + k * S, i * h, S, h);
          // veios
          ctx.strokeStyle = `rgba(90,55,25,0.18)`;
          for (let g = 0; g < 7; g++) {
            ctx.beginPath();
            const y = i * h + r() * h;
            ctx.moveTo(shift + k * S, y);
            ctx.bezierCurveTo(shift + k * S + S / 3, y + (r() - 0.5) * 10, shift + k * S + (2 * S) / 3, y + (r() - 0.5) * 10, shift + (k + 1) * S, y);
            ctx.stroke();
          }
          ctx.fillStyle = 'rgba(60,35,15,0.55)';
          ctx.fillRect(shift + k * S, i * h, 2, h);
        }
        ctx.fillStyle = 'rgba(60,35,15,0.5)';
        ctx.fillRect(0, i * h, S, 2);
      }
      noise(ctx, S, 14, r);
      break;
    }
    case 'ceramica': {
      // 50 × 50 cm
      const n = 2;
      const t = S / n;
      ctx.fillStyle = '#c9c9c4';
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const tone = 222 + r() * 14;
          ctx.fillStyle = `rgb(${tone - 6},${tone},${tone + 4})`;
          ctx.fillRect(i * t + 3, j * t + 3, t - 6, t - 6);
        }
      noise(ctx, S, 8, r);
      break;
    }
    case 'porcelanato': {
      ctx.fillStyle = '#ece9e3';
      ctx.fillRect(0, 0, S, S);
      noise(ctx, S, 10, r);
      // veios suaves
      ctx.strokeStyle = 'rgba(160,150,140,0.25)';
      for (let g = 0; g < 6; g++) {
        ctx.beginPath();
        ctx.moveTo(r() * S, 0);
        ctx.bezierCurveTo(r() * S, S / 3, r() * S, (2 * S) / 3, r() * S, S);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(120,115,110,0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, S - 2, S - 2);
      break;
    }
    case 'cimento': {
      ctx.fillStyle = '#b7b8b5';
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},0.025)`;
        ctx.beginPath();
        ctx.arc(r() * S, r() * S, 20 + r() * 80, 0, Math.PI * 2);
        ctx.fill();
      }
      noise(ctx, S, 18, r);
      break;
    }
    case 'carpete': {
      ctx.fillStyle = '#a89fb3';
      ctx.fillRect(0, 0, S, S);
      noise(ctx, S, 40, r);
      break;
    }
    case 'grama': {
      ctx.fillStyle = '#6f9a4f';
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 4000; i++) {
        const g = 110 + r() * 70;
        ctx.strokeStyle = `rgba(${g - 60},${g},${g - 80},0.6)`;
        const x = r() * S;
        const y = r() * S;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (r() - 0.5) * 4, y - 4 - r() * 6);
        ctx.stroke();
      }
      break;
    }
  }
  return c;
}

export function floorTexture(kind: FloorMaterial): THREE.Texture {
  let t = cache.get(kind);
  if (!t) {
    t = new THREE.CanvasTexture(draw(kind));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    cache.set(kind, t);
  }
  return t;
}
