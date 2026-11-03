import { useMemo } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { Floor, Furniture, Opening, Room, Vec2, Wall } from '../model/types';
import { EPS, wallCorners, wallDir, wallLength, wallPieces, wallSliceQuad } from '../model/geometry';
import { CATALOG_BY_ID, partColor } from '../catalog/items';
import { floorTexture } from './textures';

const M = 0.01; // cm → m

/** Prisma vertical a partir de um quadrilátero da planta (cm). */
function pushPrism(pos: number[], quad: Vec2[], y0: number, y1: number) {
  const P = (p: Vec2, y: number) => new THREE.Vector3(p.x * M, y * M, p.y * M);
  const bottom = quad.map((p) => P(p, y0));
  const top = quad.map((p) => P(p, y1));
  const center = new THREE.Vector3();
  [...bottom, ...top].forEach((v) => center.add(v));
  center.multiplyScalar(1 / 8);
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const fc = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3);
    if (n.dot(fc.sub(center)) < 0) pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    else pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const quadFace = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
    tri(a, b, c);
    tri(a, c, d);
  };
  quadFace(top[0], top[1], top[2], top[3]);
  quadFace(bottom[0], bottom[1], bottom[2], bottom[3]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quadFace(bottom[i], bottom[j], top[j], top[i]);
  }
}

export function buildWallGeometry(wall: Wall, walls: Wall[], openings: Opening[], cut: number | null) {
  const L = wallLength(wall);
  const corners = wallCorners(wall, walls);
  const pieces = wallPieces(L, wall.height, openings);
  const pos: number[] = [];
  for (const pc of pieces) {
    let y1 = pc.y1;
    if (cut != null) {
      if (pc.y0 >= cut) continue;
      y1 = Math.min(y1, cut);
    }
    if (pc.u1 - pc.u0 < EPS || y1 - pc.y0 < EPS) continue;
    pushPrism(pos, wallSliceQuad(wall, corners, pc.u0, pc.u1), pc.y0, y1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

type Click = (e: ThreeEvent<MouseEvent>) => void;

const HIGHLIGHT = new THREE.Color('#2f6fed');

export function WallMesh({ wall, floor, selected, cut, onClick }: { wall: Wall; floor: Floor; selected: boolean; cut: number | null; onClick?: Click }) {
  const openings = floor.openings.filter((o) => o.wallId === wall.id);
  const geom = useMemo(() => buildWallGeometry(wall, floor.walls, openings, cut), [wall, floor.walls, openings.map((o) => `${o.offset}|${o.width}|${o.sill}|${o.height}`).join(','), cut]);
  return (
    <mesh geometry={geom} castShadow receiveShadow onClick={onClick}>
      <meshStandardMaterial color={wall.color} roughness={0.92} emissive={selected ? HIGHLIGHT : undefined} emissiveIntensity={selected ? 0.35 : 0} />
    </mesh>
  );
}

/** Grupo no referencial da parede: x ao longo da parede (a→b), z na normal, y para cima. */
function WallFrame({ wall, children }: { wall: Wall; children: React.ReactNode }) {
  const d = wallDir(wall);
  return (
    <group position={[wall.a.x * M, 0, wall.a.y * M]} rotation={[0, -Math.atan2(d.y, d.x), 0]}>
      {children}
    </group>
  );
}

export function OpeningMesh({ o, wall, selected, cut, onClick }: { o: Opening; wall: Wall; selected: boolean; cut: number | null; onClick?: Click }) {
  const t = wall.thickness;
  const u0 = o.offset - o.width / 2;
  const u1 = o.offset + o.width / 2;
  const frame = 5;
  const emissive = selected ? HIGHLIGHT : undefined;
  const ei = selected ? 0.5 : 0;
  const B = (x: number, y: number, z: number, sx: number, sy0: number, sz: number, color: string, key: string, extra?: Partial<THREE.MeshPhysicalMaterialParameters>) => {
    // com "paredes baixas", recorta a peça na altura do corte
    let yc = y;
    let sy = sy0;
    if (cut != null) {
      const y0 = y - sy0 / 2;
      const y1 = Math.min(y + sy0 / 2, cut);
      if (y1 <= y0 + 0.1) return null;
      yc = (y0 + y1) / 2;
      sy = y1 - y0;
    }
    return (
      <mesh key={key} position={[x * M, yc * M, z * M]} castShadow receiveShadow>
        <boxGeometry args={[sx * M, sy * M, sz * M]} />
        {extra ? (
          <meshPhysicalMaterial color={color} {...extra} emissive={emissive} emissiveIntensity={ei} />
        ) : (
          <meshStandardMaterial color={color} roughness={0.6} emissive={emissive} emissiveIntensity={ei} />
        )}
      </mesh>
    );
  };

  if (o.kind === 'gap') {
    return (
      <WallFrame wall={wall}>
        <group onClick={onClick}>
          {/* área invisível clicável */}
          <mesh position={[o.offset * M, (o.sill + o.height / 2) * M, 0]} visible={selected}>
            <boxGeometry args={[o.width * M, o.height * M, (t + 1) * M]} />
            <meshBasicMaterial color="#2f6fed" transparent opacity={0.15} depthWrite={false} />
          </mesh>
        </group>
      </WallFrame>
    );
  }

  if (o.kind === 'window') {
    const fc = o.color;
    const yb = o.sill;
    const yt = o.sill + o.height;
    const mid = (yb + yt) / 2;
    const parts = [
      B(u0 + frame / 2, mid, 0, frame, o.height, t * 0.6, fc, 'l'),
      B(u1 - frame / 2, mid, 0, frame, o.height, t * 0.6, fc, 'r'),
      B(o.offset, yt - frame / 2, 0, o.width, frame, t * 0.6, fc, 't'),
      B(o.offset, yb + frame / 2, 0, o.width, frame, t * 0.6, fc, 'b'),
      B(o.offset, yb - 1.5, 0, o.width + 6, 3, t + 6, '#e8e4dc', 'peitoril'),
      o.width > 100 ? B(o.offset, mid, 0, 4, o.height - 2 * frame, t * 0.4, fc, 'm') : null,
      B(o.offset, mid, 0, o.width - 2 * frame, o.height - 2 * frame, 1, '#bcd9ea', 'g', {
        transparent: true,
        opacity: 0.28,
        roughness: 0.05,
        metalness: 0,
        depthWrite: false,
      }),
    ];
    return (
      <WallFrame wall={wall}>
        <group onClick={onClick}>{parts}</group>
      </WallFrame>
    );
  }

  // porta
  const s = o.flip ? -1 : 1;
  const left = o.hinge === 'left';
  const uh = left ? u0 + frame : u1 - frame;
  const dirSign = left ? 1 : -1;
  const leafLen = o.width - 2 * frame;
  const leafH = o.height - frame;
  const openAng = (50 * Math.PI) / 180;
  const phi = -s * dirSign * openAng;
  return (
    <WallFrame wall={wall}>
      <group onClick={onClick}>
        {B(u0 + frame / 2, o.sill + o.height / 2, 0, frame, o.height, t + 2, '#efe9df', 'jl')}
        {B(u1 - frame / 2, o.sill + o.height / 2, 0, frame, o.height, t + 2, '#efe9df', 'jr')}
        {B(o.offset, o.sill + o.height - frame / 2, 0, o.width, frame, t + 2, '#efe9df', 'jt')}
        {(cut == null || cut > 0) && (
          <group position={[uh * M, o.sill * M, ((s * t) / 2 - s * 2) * M]} rotation={[0, phi, 0]}>
            <mesh position={[(dirSign * leafLen * M) / 2, ((cut != null ? Math.min(leafH, cut - o.sill) : leafH) * M) / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[leafLen * M, (cut != null ? Math.min(leafH, cut - o.sill) : leafH) * M, 4 * M]} />
              <meshStandardMaterial color={o.color} roughness={0.55} emissive={emissive} emissiveIntensity={ei} />
            </mesh>
            {(cut == null || cut > 100) && (
              <mesh position={[dirSign * (leafLen - 7) * M, 1.0, s * 3 * M]}>
                <boxGeometry args={[12 * M, 2 * M, 2 * M]} />
                <meshStandardMaterial color="#c9ccd1" metalness={0.8} roughness={0.25} />
              </mesh>
            )}
          </group>
        )}
      </group>
    </WallFrame>
  );
}

export function RoomFloor({ room, selected, onClick }: { room: Room; selected: boolean; onClick?: Click }) {
  const geom = useMemo(() => {
    const shape = new THREE.Shape(room.polygon.map((p) => new THREE.Vector2(p.x * M, -p.y * M)));
    return new THREE.ShapeGeometry(shape);
  }, [room.polygon]);
  const tex = floorTexture(room.material);
  return (
    <mesh geometry={geom} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} receiveShadow onClick={onClick}>
      <meshStandardMaterial map={tex} roughness={room.material === 'porcelanato' ? 0.35 : 0.85} emissive={selected ? HIGHLIGHT : undefined} emissiveIntensity={selected ? 0.25 : 0} />
    </mesh>
  );
}

/** Laje simples sob o andar (para andares superiores). */
export function FloorSlab({ floor }: { floor: Floor }) {
  const geoms = useMemo(
    () =>
      floor.rooms.map((r) => {
        const shape = new THREE.Shape(r.polygon.map((p) => new THREE.Vector2(p.x * M, -p.y * M)));
        return new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false });
      }),
    [floor.rooms],
  );
  return (
    <>
      {geoms.map((g, i) => (
        <mesh key={i} geometry={g} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.122, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#d9d6cf" roughness={0.9} />
        </mesh>
      ))}
    </>
  );
}

const cylGeom = new THREE.CylinderGeometry(1, 1, 1, 28);
const boxGeom = new THREE.BoxGeometry(1, 1, 1);

export function FurnitureMesh({ f, selected, onClick }: { f: Furniture; selected: boolean; onClick?: Click }) {
  const item = CATALOG_BY_ID[f.catalogId];
  if (!item) return null;
  return (
    <group position={[f.x * M, f.elevation * M, f.y * M]} rotation={[0, (-f.rotation * Math.PI) / 180, 0]} onClick={onClick}>
      {item.parts.map((p, i) => {
        const color = partColor(p.c, f.color);
        const mat =
          p.m === 'glass' ? (
            <meshPhysicalMaterial color={color} transparent opacity={0.35} roughness={0.05} depthWrite={false} emissive={selected ? HIGHLIGHT : undefined} emissiveIntensity={selected ? 0.4 : 0} />
          ) : (
            <meshStandardMaterial
              color={color}
              roughness={p.m === 'metal' ? 0.3 : p.m === 'fabric' ? 0.95 : 0.65}
              metalness={p.m === 'metal' ? 0.55 : 0}
              emissive={selected ? HIGHLIGHT : undefined}
              emissiveIntensity={selected ? 0.4 : 0}
            />
          );
        const h = Math.max(p.sy * f.h, 0.5);
        if (p.t === 'box') {
          return (
            <mesh key={i} geometry={boxGeom} position={[p.x * f.w * M, (p.y * f.h + h / 2) * M, p.z * f.d * M]} scale={[p.sx * f.w * M, h * M, p.sz * f.d * M]} castShadow receiveShadow>
              {mat}
            </mesh>
          );
        }
        return (
          <mesh key={i} geometry={cylGeom} position={[p.x * f.w * M, (p.y * f.h + h / 2) * M, p.z * f.d * M]} scale={[p.rx * f.w * M, h * M, p.rz * f.d * M]} castShadow receiveShadow>
            {mat}
          </mesh>
        );
      })}
    </group>
  );
}
