import { memo } from 'react';
import type { Dimension, Floor, FloorMaterial, Furniture, Opening, Room, Vec2, Wall } from '../model/types';
import {
  add,
  cm2ToM2,
  cross,
  fmtM,
  perp,
  pointOnWall,
  polygonArea,
  polygonCentroid,
  scale,
  sub,
  wallAngleDeg,
  wallDir,
  wallLength,
  wallPolygon,
  norm,
  dist,
} from '../model/geometry';
import { CATALOG_BY_ID, partColor, type Part } from '../catalog/items';

export const MATERIAL_FILL: Record<FloorMaterial, string> = {
  madeira: '#ead9bf',
  ceramica: '#dfe8ec',
  porcelanato: '#eceae5',
  cimento: '#d9d9d6',
  carpete: '#dcd3e3',
  grama: '#d3e6c6',
};

export const MATERIAL_LABEL: Record<FloorMaterial, string> = {
  madeira: 'Madeira',
  ceramica: 'Cerâmica',
  porcelanato: 'Porcelanato',
  cimento: 'Cimento queimado',
  carpete: 'Carpete',
  grama: 'Grama',
};

const pts = (ps: Vec2[]) => ps.map((p) => `${p.x},${p.y}`).join(' ');

type Down = (e: React.PointerEvent, kind: 'wall' | 'opening' | 'room' | 'furniture' | 'dimension', id: string) => void;

interface LayerProps {
  floor: Floor;
  px: number; // tamanho de 1 pixel em cm
  selectedId: string | null;
  onDown: Down;
}

/** texto legível ao longo de um ângulo (nunca de cabeça para baixo) */
function readableAngle(deg: number) {
  let a = deg;
  while (a > 90) a -= 180;
  while (a <= -90) a += 180;
  return a;
}

export const RoomsLayer = memo(function RoomsLayer({ floor, px, selectedId, onDown }: LayerProps) {
  return (
    <g>
      {floor.rooms.map((r) => (
        <polygon
          key={r.id}
          points={pts(r.polygon)}
          fill={MATERIAL_FILL[r.material]}
          stroke={r.id === selectedId ? 'var(--accent)' : 'none'}
          strokeWidth={2 * px}
          strokeDasharray={`${6 * px} ${4 * px}`}
          onPointerDown={(e) => onDown(e, 'room', r.id)}
          data-hit="room"
        />
      ))}
    </g>
  );
});

export function RoomLabels({ rooms, px }: { rooms: Room[]; px: number }) {
  return (
    <g className="labels" pointerEvents="none">
      {rooms.map((r) => {
        const c = polygonCentroid(r.polygon);
        const fs = Math.min(14 * px, 40);
        return (
          <g key={r.id}>
            <text x={c.x} y={c.y - fs * 0.2} fontSize={fs} textAnchor="middle" fontWeight={600} fill="#3a3a3a" className="halo" strokeWidth={3 * px}>
              {r.name}
            </text>
            <text x={c.x} y={c.y + fs * 1.05} fontSize={fs * 0.85} textAnchor="middle" fill="#666" className="halo" strokeWidth={3 * px}>
              {cm2ToM2(polygonArea(r.polygon)).toFixed(2).replace('.', ',')} m²
            </text>
          </g>
        );
      })}
    </g>
  );
}

export const WallsLayer = memo(function WallsLayer({ floor, px, selectedId, onDown }: LayerProps) {
  return (
    <g>
      {floor.walls.map((w) => (
        <polygon
          key={w.id}
          points={pts(wallPolygon(w, floor.walls))}
          fill={w.id === selectedId ? 'var(--accent)' : '#3d4149'}
          stroke={w.id === selectedId ? 'var(--accent)' : '#2a2d33'}
          strokeWidth={0.8 * px}
          strokeLinejoin="round"
          onPointerDown={(e) => onDown(e, 'wall', w.id)}
          data-hit="wall"
        />
      ))}
    </g>
  );
});

export function OpeningShape({ o, wall, px, selected, ghost }: { o: Opening; wall: Wall; px: number; selected?: boolean; ghost?: boolean }) {
  const t = wall.thickness;
  const u0 = o.offset - o.width / 2;
  const u1 = o.offset + o.width / 2;
  const d = wallDir(wall);
  const n = perp(d);
  const c0L = pointOnWall(wall, u0, t / 2 + 0.6);
  const c1L = pointOnWall(wall, u1, t / 2 + 0.6);
  const c1R = pointOnWall(wall, u1, -t / 2 - 0.6);
  const c0R = pointOnWall(wall, u0, -t / 2 - 0.6);
  const stroke = selected ? 'var(--accent)' : ghost ? 'var(--accent)' : '#2a2d33';
  const sw = (selected ? 2 : 1.2) * px;
  const cut = <polygon points={pts([c0L, c1L, c1R, c0R])} fill={ghost ? 'rgba(47,111,237,0.18)' : '#ffffff'} stroke="none" />;

  if (o.kind === 'window') {
    const g1a = pointOnWall(wall, u0, t / 6);
    const g1b = pointOnWall(wall, u1, t / 6);
    const g2a = pointOnWall(wall, u0, -t / 6);
    const g2b = pointOnWall(wall, u1, -t / 6);
    return (
      <g>
        {cut}
        <polygon points={pts([pointOnWall(wall, u0, t / 2), pointOnWall(wall, u1, t / 2), pointOnWall(wall, u1, -t / 2), pointOnWall(wall, u0, -t / 2)])} fill="none" stroke={stroke} strokeWidth={sw} />
        <line x1={g1a.x} y1={g1a.y} x2={g1b.x} y2={g1b.y} stroke={stroke} strokeWidth={sw} />
        <line x1={g2a.x} y1={g2a.y} x2={g2b.x} y2={g2b.y} stroke={stroke} strokeWidth={sw} />
      </g>
    );
  }

  if (o.kind === 'gap') {
    return (
      <g>
        {cut}
        <line x1={c0L.x} y1={c0L.y} x2={c0R.x} y2={c0R.y} stroke={stroke} strokeWidth={sw} strokeDasharray={`${3 * px} ${2 * px}`} />
        <line x1={c1L.x} y1={c1L.y} x2={c1R.x} y2={c1R.y} stroke={stroke} strokeWidth={sw} strokeDasharray={`${3 * px} ${2 * px}`} />
      </g>
    );
  }

  // porta
  const s = o.flip ? -1 : 1;
  const uh = o.hinge === 'left' ? u0 : u1;
  const uo = o.hinge === 'left' ? u1 : u0;
  const H = pointOnWall(wall, uh, (s * t) / 2);
  const leafEnd = add(H, scale(n, s * o.width));
  const other = pointOnWall(wall, uo, (s * t) / 2);
  const sweep = cross(sub(leafEnd, H), sub(other, H)) > 0 ? 1 : 0;
  return (
    <g>
      {cut}
      <line x1={c0L.x} y1={c0L.y} x2={c0R.x} y2={c0R.y} stroke={stroke} strokeWidth={sw} />
      <line x1={c1L.x} y1={c1L.y} x2={c1R.x} y2={c1R.y} stroke={stroke} strokeWidth={sw} />
      <line x1={H.x} y1={H.y} x2={leafEnd.x} y2={leafEnd.y} stroke={stroke} strokeWidth={sw * 1.6} />
      <path
        d={`M ${leafEnd.x} ${leafEnd.y} A ${o.width} ${o.width} 0 0 ${sweep} ${other.x} ${other.y}`}
        fill="none"
        stroke={stroke}
        strokeWidth={sw * 0.8}
        strokeDasharray={`${4 * px} ${3 * px}`}
      />
    </g>
  );
}

export const OpeningsLayer = memo(function OpeningsLayer({ floor, px, selectedId, onDown }: LayerProps) {
  return (
    <g>
      {floor.openings.map((o) => {
        const w = floor.walls.find((x) => x.id === o.wallId);
        if (!w) return null;
        return (
          <g key={o.id} onPointerDown={(e) => onDown(e, 'opening', o.id)} data-hit="opening" style={{ cursor: 'grab' }}>
            {/* área de clique maior */}
            <polygon
              points={pts([
                pointOnWall(w, o.offset - o.width / 2, w.thickness / 2 + 4 * px),
                pointOnWall(w, o.offset + o.width / 2, w.thickness / 2 + 4 * px),
                pointOnWall(w, o.offset + o.width / 2, -w.thickness / 2 - 4 * px),
                pointOnWall(w, o.offset - o.width / 2, -w.thickness / 2 - 4 * px),
              ])}
              fill="transparent"
            />
            <OpeningShape o={o} wall={w} px={px} selected={o.id === selectedId} />
          </g>
        );
      })}
    </g>
  );
});

/** Símbolo de planta baixa do móvel: vista de cima das partes. */
export function FurnitureSymbol({ f, px, selected, ghost }: { f: Pick<Furniture, 'catalogId' | 'w' | 'd' | 'color'>; px: number; selected?: boolean; ghost?: boolean }) {
  const item = CATALOG_BY_ID[f.catalogId];
  if (!item) return null;
  const parts = [...item.parts].sort((a, b) => a.y + a.sy - (b.y + b.sy));
  const stroke = selected ? 'var(--accent)' : '#4a4d55';
  const sw = (selected ? 1.6 : 0.8) * px;
  const fillOf = (p: Part) => partColor(p.c, f.color);
  return (
    <g opacity={ghost ? 0.6 : 1}>
      {parts.map((p, i) =>
        p.t === 'box' ? (
          <rect
            key={i}
            x={(p.x - p.sx / 2) * f.w}
            y={(p.z - p.sz / 2) * f.d}
            width={p.sx * f.w}
            height={p.sz * f.d}
            fill={fillOf(p)}
            fillOpacity={p.m === 'glass' ? 0.35 : 1}
            stroke={stroke}
            strokeWidth={sw}
          />
        ) : (
          <ellipse key={i} cx={p.x * f.w} cy={p.z * f.d} rx={p.rx * f.w} ry={p.rz * f.d} fill={fillOf(p)} fillOpacity={p.m === 'glass' ? 0.35 : 1} stroke={stroke} strokeWidth={sw} />
        ),
      )}
      {selected && (
        <rect x={-f.w / 2} y={-f.d / 2} width={f.w} height={f.d} fill="none" stroke="var(--accent)" strokeWidth={1.5 * px} strokeDasharray={`${5 * px} ${3 * px}`} />
      )}
    </g>
  );
}

export const FurnitureLayer = memo(function FurnitureLayer({ floor, px, selectedId, onDown }: LayerProps) {
  return (
    <g>
      {floor.furniture.map((f) => (
        <g
          key={f.id}
          transform={`translate(${f.x} ${f.y}) rotate(${f.rotation})`}
          onPointerDown={(e) => onDown(e, 'furniture', f.id)}
          data-hit="furniture"
          style={{ cursor: 'move' }}
        >
          <rect x={-f.w / 2} y={-f.d / 2} width={f.w} height={f.d} fill="transparent" />
          <FurnitureSymbol f={f} px={px} selected={f.id === selectedId} />
        </g>
      ))}
    </g>
  );
});

export function DimensionLine({ a, b, px, offset = 0, color = '#2b6be0', selected, label }: { a: Vec2; b: Vec2; px: number; offset?: number; color?: string; selected?: boolean; label?: string }) {
  const L = dist(a, b);
  if (L < 1) return null;
  const d = norm(sub(b, a));
  const n = perp(d);
  const A = add(a, scale(n, offset));
  const Bp = add(b, scale(n, offset));
  const mid = scale(add(A, Bp), 0.5);
  const ang = readableAngle((Math.atan2(d.y, d.x) * 180) / Math.PI);
  const tick = 5 * px;
  const fs = 11 * px;
  const textW = (label ?? fmtM(L)).length * fs * 0.58;
  const showText = textW < L * 1.4;
  const c = selected ? 'var(--accent)' : color;
  return (
    <g pointerEvents="none">
      <line x1={A.x} y1={A.y} x2={Bp.x} y2={Bp.y} stroke={c} strokeWidth={1 * px} />
      {[A, Bp].map((p, i) => (
        <line key={i} x1={p.x - (n.x + d.x) * tick} y1={p.y - (n.y + d.y) * tick} x2={p.x + (n.x + d.x) * tick} y2={p.y + (n.y + d.y) * tick} stroke={c} strokeWidth={1.2 * px} />
      ))}
      {showText && (
        <text
          x={mid.x}
          y={mid.y}
          fontSize={fs}
          fill={c}
          textAnchor="middle"
          dy={-3 * px}
          transform={`rotate(${ang} ${mid.x} ${mid.y})`}
          className="halo" strokeWidth={3 * px}
          fontWeight={500}
        >
          {label ?? fmtM(L)}
        </text>
      )}
    </g>
  );
}

/** Cotas automáticas: comprimento de cada parede. */
export function WallDimensions({ walls, px }: { walls: Wall[]; px: number }) {
  return (
    <g className="auto-dims">
      {walls.map((w) => {
        const L = wallLength(w);
        if (L < 20) return null;
        const off = w.thickness / 2 + 14 * px;
        return <DimensionLine key={w.id} a={w.a} b={w.b} px={px} offset={-off} color="#8a8f98" label={fmtM(L)} />;
      })}
    </g>
  );
}

export function ManualDimensions({ dims, px, selectedId, onDown }: { dims: Dimension[]; px: number; selectedId: string | null; onDown: Down }) {
  return (
    <g>
      {dims.map((dm) => (
        <g key={dm.id}>
          <line x1={dm.a.x} y1={dm.a.y} x2={dm.b.x} y2={dm.b.y} stroke="transparent" strokeWidth={10 * px} onPointerDown={(e) => onDown(e, 'dimension', dm.id)} data-hit="dimension" />
          <DimensionLine a={dm.a} b={dm.b} px={px} selected={dm.id === selectedId} color="#d0532c" />
        </g>
      ))}
    </g>
  );
}

export function GhostFloor({ floor }: { floor: Floor }) {
  return (
    <g pointerEvents="none" opacity={0.25}>
      {floor.walls.map((w) => (
        <polygon key={w.id} points={pts(wallPolygon(w, floor.walls))} fill="#7c8696" />
      ))}
    </g>
  );
}

export { wallAngleDeg };
