import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Grid, OrbitControls, PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitImpl } from 'three-stdlib';
import { currentFloor, useStore } from '../model/store';
import type { EntityKind, Floor, Project } from '../model/types';
import { boundsOf, polygonCentroid } from '../model/geometry';
import { nodesOf } from '../editor2d/snap';
import { FloorSlab, FurnitureMesh, OpeningMesh, RoomFloor, WallMesh } from './meshes';

function projectBounds(p: Project) {
  const pts = p.floors.flatMap((f) => [...nodesOf(f), ...f.furniture.map((x) => ({ x: x.x, y: x.y }))]);
  if (!pts.length) return { cx: 4, cz: 3, size: 10 };
  const b = boundsOf(pts);
  return { cx: ((b.minX + b.maxX) / 2) / 100, cz: ((b.minY + b.maxY) / 2) / 100, size: Math.max(b.maxX - b.minX, b.maxY - b.minY, 300) / 100 };
}

function FloorGroup({ floor, active, cut }: { floor: Floor; active: boolean; cut: number | null }) {
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const sel = active ? selection?.id : undefined;
  const click = (kind: EntityKind, id: string) => (e: ThreeEvent<MouseEvent>) => {
    if (!active || e.delta > 4) return;
    e.stopPropagation();
    select({ kind, id });
  };
  return (
    <group position={[0, floor.elevation / 100, 0]}>
      {floor.elevation > 0 && <FloorSlab floor={floor} />}
      {floor.rooms.map((r) => (
        <RoomFloor key={r.id} room={r} selected={sel === r.id} onClick={click('room', r.id)} />
      ))}
      {floor.walls.map((w) => (
        <WallMesh key={w.id} wall={w} floor={floor} selected={sel === w.id} cut={cut} onClick={click('wall', w.id)} />
      ))}
      {floor.openings.map((o) => {
        const w = floor.walls.find((x) => x.id === o.wallId);
        return w ? <OpeningMesh key={o.id} o={o} wall={w} selected={sel === o.id} cut={cut} onClick={click('opening', o.id)} /> : null;
      })}
      {floor.furniture.map((f) => (
        <FurnitureMesh key={f.id} f={f} selected={sel === f.id} onClick={click('furniture', f.id)} />
      ))}
    </group>
  );
}

function CameraRig({ controls }: { controls: React.RefObject<OrbitImpl> }) {
  const project = useStore((s) => s.project);
  const fitNonce = useStore((s) => s.fitNonce);
  const { camera } = useThree();
  useEffect(() => {
    const b = projectBounds(useStore.getState().project);
    const dist = b.size * 1.1 + 4;
    camera.position.set(b.cx + dist * 0.55, dist * 0.85, b.cz + dist * 0.95);
    controls.current?.target.set(b.cx, 0.6, b.cz);
    controls.current?.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, fitNonce]);
  return null;
}

const keys: Record<string, boolean> = {};

function FirstPersonMover({ elevation }: { elevation: number }) {
  const { camera } = useThree();
  const project = useStore((s) => s.project);
  const floorId = useStore((s) => s.floorId);
  useEffect(() => {
    const f = currentFloor(project, floorId);
    const room = f.rooms.find((r) => /sala/i.test(r.name)) ?? f.rooms[0];
    const c = room ? polygonCentroid(room.polygon) : { x: 200, y: 200 };
    const eye = elevation / 100 + 1.6;
    camera.position.set(c.x / 100, eye, c.y / 100);
    // olha na horizontal, em direção ao centro da casa (ou para +x se já estiver no centro)
    const b = projectBounds(project);
    const dx = b.cx - c.x / 100;
    const dz = b.cz - c.y / 100;
    const l = Math.hypot(dx, dz);
    camera.lookAt(c.x / 100 + (l > 0.5 ? dx / l : 1), eye, c.y / 100 + (l > 0.5 ? dz / l : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const kd = (e: KeyboardEvent) => (keys[e.code] = true);
    const ku = (e: KeyboardEvent) => (keys[e.code] = false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }, []);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const speed = (keys.ShiftLeft || keys.ShiftRight ? 3.2 : 1.6) * Math.min(dt, 0.05);
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    right.crossVectors(fwd, camera.up).normalize();
    if (keys.KeyW || keys.ArrowUp) camera.position.addScaledVector(fwd, speed);
    if (keys.KeyS || keys.ArrowDown) camera.position.addScaledVector(fwd, -speed);
    if (keys.KeyD || keys.ArrowRight) camera.position.addScaledVector(right, speed);
    if (keys.KeyA || keys.ArrowLeft) camera.position.addScaledVector(right, -speed);
    camera.position.y = elevation / 100 + 1.6;
  });
  return null;
}

function Lights({ cx, cz, size }: { cx: number; cz: number; size: number }) {
  const light = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    l.target.position.set(cx, 0, cz);
    l.target.updateMatrixWorld();
    const s = size * 0.9 + 3;
    const cam = l.shadow.camera as THREE.OrthographicCamera;
    cam.left = -s;
    cam.right = s;
    cam.top = s;
    cam.bottom = -s;
    cam.updateProjectionMatrix();
  }, [cx, cz, size]);
  return (
    <>
      <hemisphereLight args={['#f4f7ff', '#b9a98e', 0.9]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        ref={light}
        position={[cx + size * 0.6 + 4, size + 8, cz + size * 0.35 + 3]}
        intensity={1.9}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
    </>
  );
}

export default function Scene3D() {
  const project = useStore((s) => s.project);
  const floorId = useStore((s) => s.floorId);
  const showAllFloors = useStore((s) => s.showAllFloors);
  const firstPerson = useStore((s) => s.firstPerson);
  const setS = useStore((s) => s.set);
  const select = useStore((s) => s.select);
  const [lowWalls, setLowWalls] = useState(false);
  const [locked, setLocked] = useState(false);
  const controls = useRef<OrbitImpl>(null);

  const active = currentFloor(project, floorId);
  const visible = project.floors.filter((f) => showAllFloors || f.elevation <= active.elevation);
  const b = projectBounds(project);
  const cut = lowWalls && !firstPerson ? 110 : null;

  return (
    <div className="view3d">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        camera={{ fov: firstPerson ? 70 : 45, near: 0.05, far: 500, position: [10, 10, 10] }}
        onPointerMissed={(e) => e.type === 'click' && !firstPerson && select(null)}
      >
        <color attach="background" args={['#e6edf4']} />
        <fog attach="fog" args={['#e6edf4', 40, 140]} />
        <Lights cx={b.cx} cz={b.cz} size={b.size} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[b.cx, -0.002, b.cz]} receiveShadow>
          <planeGeometry args={[400, 400]} />
          <meshStandardMaterial color="#e3e6df" roughness={1} />
        </mesh>
        <Grid
          position={[0, 0, 0]}
          args={[200, 200]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#cfd5dc"
          sectionSize={1}
          sectionThickness={0.9}
          sectionColor="#b9c1cb"
          fadeDistance={60}
          infiniteGrid
        />
        {visible.map((f) => (
          <FloorGroup key={f.id} floor={f} active={f.id === active.id} cut={f.id === active.id ? cut : f.elevation > active.elevation ? cut : null} />
        ))}
        {firstPerson ? (
          <>
            <PointerLockControls onLock={() => setLocked(true)} onUnlock={() => setLocked(false)} selector="#fp-start" />
            <FirstPersonMover elevation={active.elevation} />
          </>
        ) : (
          <>
            <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12} maxPolarAngle={Math.PI / 2 - 0.02} minDistance={1} maxDistance={120} />
            <CameraRig controls={controls} />
          </>
        )}
      </Canvas>

      <div className="view3d-ctrls">
        <button className={firstPerson ? 'on' : ''} onClick={() => setS('firstPerson', !firstPerson)} title="Ver a casa na altura dos olhos">
          {firstPerson ? '← Vista orbital' : '🚶 Andar pela casa'}
        </button>
        {!firstPerson && (
          <button className={lowWalls ? 'on' : ''} onClick={() => setLowWalls((v) => !v)} title="Corta as paredes a 1,10 m para ver os móveis">
            Paredes baixas
          </button>
        )}
        {project.floors.length > 1 && (
          <button className={!showAllFloors ? 'on' : ''} onClick={() => setS('showAllFloors', !showAllFloors)} title="Esconde os andares acima do atual">
            Esconder andares acima
          </button>
        )}
      </div>
      {firstPerson && !locked && (
        <div className="fp-overlay">
          <button id="fp-start">Clique para entrar</button>
          <p>
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> para andar · mouse para olhar · <kbd>Shift</kbd> corre · <kbd>Esc</kbd> solta o mouse
          </p>
        </div>
      )}
      {!firstPerson && <div className="hint hint3d">Arraste para girar · botão direito move · roda = zoom · clique para selecionar</div>}
    </div>
  );
}
