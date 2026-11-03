import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EntityKind, Floor, Vec2, Wall } from '../model/types';
import {
  add,
  boundsOf,
  clampOpening,
  cm2ToM2,
  dist,
  fmtM,
  fmtM2,
  norm,
  parseLength,
  polygonArea,
  projectOnSegment,
  rectCorners,
  samePoint,
  scale,
  snapToGrid,
  sub,
  uid,
  wallLength,
} from '../model/geometry';
import { currentFloor, makeFurniture, moveNode, OPENING_DEFAULTS, showToast, tryAddOpening, useStore } from '../model/store';
import { nearestWall, nodesOf, snapPoint } from './snap';
import {
  DimensionLine,
  FurnitureLayer,
  FurnitureSymbol,
  GhostFloor,
  ManualDimensions,
  OpeningShape,
  OpeningsLayer,
  RoomLabels,
  RoomsLayer,
  WallDimensions,
  WallsLayer,
} from './layers';
import { drawKeys } from './keybus';
import { CATALOG_BY_ID } from '../catalog/items';

type DragMode = 'pan' | 'furniture' | 'rotate' | 'wall' | 'node' | 'opening' | 'room' | 'roomVertex' | 'dimension';

interface DragState {
  mode: DragMode;
  id?: string;
  startWorld: Vec2;
  startClient: Vec2;
  startView?: { cx: number; cy: number };
  from?: Vec2;
  index?: number;
  moved: boolean;
}

const TOOL_HINTS: Record<string, string> = {
  select: 'Clique para selecionar · arraste para mover · arraste o fundo para navegar · roda do mouse = zoom',
  pan: 'Arraste para mover a vista',
  wall: 'Clique para começar a parede · digite a medida (ex.: 3,45) + Enter · Shift trava 45° · Esc ou duplo-clique termina',
  room: 'Arraste para desenhar um cômodo retangular',
  roomPoly: 'Clique nos cantos do cômodo · clique no primeiro ponto ou Enter para fechar · Backspace desfaz ponto',
  door: 'Clique sobre uma parede para colocar a porta',
  window: 'Clique sobre uma parede para colocar a janela',
  gap: 'Clique sobre uma parede para abrir um vão',
  furniture: 'Clique para posicionar · R gira 90° · Esc cancela',
  dimension: 'Clique no ponto inicial e no ponto final da cota',
};

function niceScaleBar(cmPerPx: number) {
  const target = 110 * cmPerPx;
  const steps = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];
  return steps.find((s) => s >= target) ?? 10000;
}

function wallExists(f: Floor, a: Vec2, b: Vec2) {
  return f.walls.some((w) => (samePoint(w.a, a) && samePoint(w.b, b)) || (samePoint(w.a, b) && samePoint(w.b, a)));
}

export default function Canvas2D() {
  const project = useStore((s) => s.project);
  const floorId = useStore((s) => s.floorId);
  const tool = useStore((s) => s.tool);
  const selection = useStore((s) => s.selection);
  const pendingCatalogId = useStore((s) => s.pendingCatalogId);
  const fitNonce = useStore((s) => s.fitNonce);
  const api = useStore.getState;

  const floor = currentFloor(project, floorId);
  const floorIdx = project.floors.indexOf(floor);
  const below = floorIdx > 0 ? project.floors[floorIdx - 1] : null;
  const { gridCm, snap: gridOn, wallThickness, wallHeight } = project.settings;

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ cx: 450, cy: 350, scale: 0.8 });
  const px = 1 / view.scale;

  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const [snapKind, setSnapKind] = useState<string>('free');
  const [chain, setChain] = useState<Vec2[]>([]);
  const [poly, setPoly] = useState<Vec2[]>([]);
  const [rectStart, setRectStart] = useState<Vec2 | null>(null);
  const [dimStart, setDimStart] = useState<Vec2 | null>(null);
  const [typed, setTyped] = useState('');
  const [ghostRot, setGhostRot] = useState(0);
  const [space, setSpace] = useState(false);
  const drag = useRef<DragState | null>(null);
  const shiftRef = useRef(false);

  // limpa estados de desenho ao trocar de ferramenta/andar
  useEffect(() => {
    setChain([]);
    setPoly([]);
    setRectStart(null);
    setDimStart(null);
    setTyped('');
  }, [tool, floorId]);

  // tamanho do canvas
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    const f = currentFloor(useStore.getState().project, useStore.getState().floorId);
    const points = [...nodesOf(f), ...f.furniture.flatMap((it) => rectCorners(it.x, it.y, it.w, it.d, it.rotation))];
    if (!points.length) {
      setView({ cx: 400, cy: 300, scale: Math.min(w / 1200, h / 900) });
      return;
    }
    const b = boundsOf(points);
    const bw = b.maxX - b.minX + 160;
    const bh = b.maxY - b.minY + 160;
    setView({ cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2, scale: Math.max(0.05, Math.min(8, Math.min(w / bw, h / bh))) });
  }, []);

  const fittedOnce = useRef(false);
  useEffect(() => {
    if (size.w && !fittedOnce.current) {
      fittedOnce.current = true;
      fit();
    }
  }, [size.w, fit]);
  useEffect(() => {
    fit();
  }, [fitNonce, project.id, fit]);

  const toWorld = useCallback(
    (clientX: number, clientY: number): Vec2 => {
      const r = svgRef.current!.getBoundingClientRect();
      return { x: view.cx + (clientX - r.left - size.w / 2) / view.scale, y: view.cy + (clientY - r.top - size.h / 2) / view.scale };
    },
    [view, size],
  );

  // zoom com a roda (listener não-passivo para impedir rolagem da página)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      setView((v) => {
        const wx = v.cx + (sx - size.w / 2) / v.scale;
        const wy = v.cy + (sy - size.h / 2) / v.scale;
        const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
        const ns = Math.max(0.05, Math.min(10, v.scale * factor));
        return { scale: ns, cx: wx - (sx - size.w / 2) / ns, cy: wy - (sy - size.h / 2) / ns };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [size]);

  const doSnap = useCallback(
    (raw: Vec2, origin?: Vec2 | null, extra?: Vec2[], exclude?: Vec2[]) =>
      snapPoint(raw, { floor, grid: gridCm, gridOn, pxToCm: px, origin, lockAngle: shiftRef.current, extra, exclude }),
    [floor, gridCm, gridOn, px],
  );

  const newWall = (a: Vec2, b: Vec2): Wall => ({ id: uid('wall'), a: { ...a }, b: { ...b }, thickness: wallThickness, height: wallHeight, color: '#f2efe9' });

  // ───────────────────────── ações de desenho ─────────────────────────
  const addWallPoint = (p: Vec2) => {
    if (!chain.length) {
      setChain([p]);
      return;
    }
    const last = chain[chain.length - 1];
    if (dist(last, p) < 1) {
      setChain([]);
      return;
    }
    api().commit((_, f) => {
      if (!wallExists(f, last, p)) f.walls.push(newWall(last, p));
    });
    setTyped('');
    if (chain.length >= 2 && samePoint(p, chain[0])) setChain([]);
    else setChain([...chain, p]);
  };

  const createRoom = (polygon: Vec2[]) => {
    if (polygon.length < 3 || polygonArea(polygon) < 400) return;
    const id = uid('room');
    const withWalls = api().roomCreatesWalls;
    api().commit((_, f) => {
      f.rooms.push({ id, name: `Cômodo ${f.rooms.length + 1}`, polygon: polygon.map((p) => ({ ...p })), material: 'madeira' });
      if (withWalls) {
        for (let i = 0; i < polygon.length; i++) {
          const a = polygon[i];
          const b = polygon[(i + 1) % polygon.length];
          if (!wallExists(f, a, b)) f.walls.push(newWall(a, b));
        }
      }
    });
    api().select({ kind: 'room', id });
  };

  const placeOpening = (kind: 'door' | 'window' | 'gap', world: Vec2) => {
    const nw = nearestWall(floor, world, 14 * px);
    if (!nw) {
      showToast('Clique sobre uma parede.');
      return;
    }
    const w = floor.walls.find((x) => x.id === nw.wallId)!;
    const fits = clampOpening(nw.along, OPENING_DEFAULTS[kind].width, wallLength(w), floor.openings.filter((o) => o.wallId === w.id));
    if (fits == null) {
      showToast('Não cabe aqui: a parede é curta ou já tem outra abertura nesse ponto.');
      return;
    }
    let newId: string | null = null;
    api().commit((_, f) => {
      newId = tryAddOpening(f, nw.wallId, kind, nw.along);
    });
    if (newId) api().select({ kind: 'opening', id: newId });
  };

  const placeFurniture = (world: Vec2) => {
    if (!pendingCatalogId) return;
    const p = gridOn ? snapToGrid(world, 5) : world;
    const it = makeFurniture(pendingCatalogId, p.x, p.y, ghostRot);
    api().commit((_, f) => f.furniture.push(it));
    api().setTool('select');
    api().select({ kind: 'furniture', id: it.id });
  };

  // ───────────────────────── teclado do desenho ─────────────────────────
  useEffect(() => {
    drawKeys.handler = (e) => {
      if (tool === 'wall' && chain.length) {
        if (/^[0-9.,]$/.test(e.key) || (e.key === 'm' && typed) || (e.key === 'c' && typed)) {
          setTyped((t) => t + e.key);
          return true;
        }
        if (e.key === 'Backspace' && typed) {
          setTyped((t) => t.slice(0, -1));
          return true;
        }
        if (e.key === 'Enter') {
          const L = parseLength(typed);
          if (L && L > 0) {
            const last = chain[chain.length - 1];
            const dir = cursor && dist(cursor, last) > 0.5 ? norm(sub(cursor, last)) : { x: 1, y: 0 };
            addWallPoint({ x: Math.round((last.x + dir.x * L) * 10) / 10, y: Math.round((last.y + dir.y * L) * 10) / 10 });
          } else setChain([]);
          setTyped('');
          return true;
        }
        if (e.key === 'Escape') {
          setChain([]);
          setTyped('');
          return true;
        }
      }
      if (tool === 'roomPoly' && poly.length) {
        if (e.key === 'Enter') {
          createRoom(poly);
          setPoly([]);
          return true;
        }
        if (e.key === 'Backspace') {
          setPoly((p) => p.slice(0, -1));
          return true;
        }
        if (e.key === 'Escape') {
          setPoly([]);
          return true;
        }
      }
      if (tool === 'furniture' && (e.key === 'r' || e.key === 'R')) {
        setGhostRot((r) => (r + 90) % 360);
        return true;
      }
      if ((rectStart || dimStart) && e.key === 'Escape') {
        setRectStart(null);
        setDimStart(null);
        return true;
      }
      return false;
    };
    return () => {
      drawKeys.handler = null;
    };
  });

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      shiftRef.current = e.shiftKey;
      if (e.key === ' ' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setSpace(true);
        e.preventDefault();
      }
    };
    const ku = (e: KeyboardEvent) => {
      shiftRef.current = e.shiftKey;
      if (e.key === ' ') setSpace(false);
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }, []);

  // ───────────────────────── ponteiro ─────────────────────────
  const startDrag = (e: React.PointerEvent, st: Omit<DragState, 'startClient' | 'moved' | 'startWorld'>) => {
    const world = toWorld(e.clientX, e.clientY);
    drag.current = { ...st, startWorld: world, startClient: { x: e.clientX, y: e.clientY }, moved: false, startView: { cx: view.cx, cy: view.cy } };
    if (st.mode !== 'pan') api().beginDrag();
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onEntityDown = (e: React.PointerEvent, kind: EntityKind, id: string) => {
    if (tool !== 'select' || e.button !== 0 || space) return;
    e.stopPropagation();
    api().select({ kind, id });
    const world = toWorld(e.clientX, e.clientY);
    if (kind === 'wall') {
      const w = floor.walls.find((x) => x.id === id)!;
      const near = [w.a, w.b].find((p) => dist(p, world) < 12 * px);
      if (near) return startDrag(e, { mode: 'node', from: { ...near } });
    }
    const mode: DragMode = kind === 'wall' ? 'wall' : kind === 'opening' ? 'opening' : kind === 'room' ? 'room' : kind === 'furniture' ? 'furniture' : 'dimension';
    startDrag(e, { mode, id });
  };

  const onHandleDown = (e: React.PointerEvent, st: Omit<DragState, 'startClient' | 'moved' | 'startWorld'>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    startDrag(e, st);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    const world = toWorld(e.clientX, e.clientY);
    shiftRef.current = e.shiftKey;
    if (e.button === 1 || tool === 'pan' || space) {
      e.preventDefault();
      return startDrag(e, { mode: 'pan' });
    }
    switch (tool) {
      case 'select':
        api().select(null);
        return startDrag(e, { mode: 'pan' });
      case 'wall': {
        const s = doSnap(world, chain[chain.length - 1], chain);
        return addWallPoint(s.p);
      }
      case 'room': {
        const s = doSnap(world);
        setRectStart(s.p);
        svgRef.current?.setPointerCapture(e.pointerId);
        return;
      }
      case 'roomPoly': {
        const s = doSnap(world, poly[poly.length - 1], poly);
        if (poly.length >= 3 && samePoint(s.p, poly[0])) {
          createRoom(poly);
          setPoly([]);
        } else if (!poly.length || !samePoint(s.p, poly[poly.length - 1])) setPoly([...poly, s.p]);
        return;
      }
      case 'door':
      case 'window':
      case 'gap':
        return placeOpening(tool, world);
      case 'furniture':
        return placeFurniture(world);
      case 'dimension': {
        const s = doSnap(world, dimStart);
        if (!dimStart) setDimStart(s.p);
        else {
          if (dist(dimStart, s.p) > 1) {
            const id = uid('dim');
            api().commit((_, f) => f.dimensions.push({ id, a: dimStart, b: s.p }));
          }
          setDimStart(null);
        }
        return;
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const world = toWorld(e.clientX, e.clientY);
    shiftRef.current = e.shiftKey;
    const d = drag.current;
    if (d) {
      if (!d.moved && dist({ x: e.clientX, y: e.clientY }, d.startClient) > 3) d.moved = true;
      if (!d.moved) return;
      const delta = sub(world, d.startWorld);
      const gridDelta = gridOn ? snapToGrid(delta, gridCm) : { x: Math.round(delta.x), y: Math.round(delta.y) };
      const base = api().dragBase;
      const baseFloor = base ? currentFloor(base, floorId) : floor;
      switch (d.mode) {
        case 'pan': {
          const dx = (e.clientX - d.startClient.x) / view.scale;
          const dy = (e.clientY - d.startClient.y) / view.scale;
          setView((v) => ({ ...v, cx: d.startView!.cx - dx, cy: d.startView!.cy - dy }));
          return;
        }
        case 'furniture': {
          const bf = baseFloor.furniture.find((x) => x.id === d.id);
          if (!bf) return;
          let p = add(bf, delta);
          if (gridOn) p = snapToGrid(p, 5);
          api().dragUpdate((_, f) => {
            const it = f.furniture.find((x) => x.id === d.id)!;
            it.x = Math.round(p.x * 10) / 10;
            it.y = Math.round(p.y * 10) / 10;
          });
          return;
        }
        case 'rotate': {
          const bf = baseFloor.furniture.find((x) => x.id === d.id);
          if (!bf) return;
          let ang = (Math.atan2(world.y - bf.y, world.x - bf.x) * 180) / Math.PI + 90;
          ang = e.shiftKey ? Math.round(ang) : Math.round(ang / 15) * 15;
          api().dragUpdate((_, f) => {
            const it = f.furniture.find((x) => x.id === d.id)!;
            it.rotation = ((ang % 360) + 360) % 360;
          });
          return;
        }
        case 'wall': {
          const bw = baseFloor.walls.find((x) => x.id === d.id);
          if (!bw) return;
          api().dragUpdate((_, f) => {
            const na = add(bw.a, gridDelta);
            const nb = add(bw.b, gridDelta);
            // move pelas posições originais para não confundir os nós
            const tmp = { x: 1e9, y: 1e9 };
            moveNode(f, bw.b, tmp);
            moveNode(f, bw.a, na);
            moveNode(f, tmp, nb);
          });
          return;
        }
        case 'node': {
          const s = doSnap(world, null, undefined, [d.from!]);
          setSnapKind(s.kind);
          setCursor(s.p);
          api().dragUpdate((_, f) => moveNode(f, d.from!, s.p));
          return;
        }
        case 'opening': {
          const bo = baseFloor.openings.find((x) => x.id === d.id);
          if (!bo) return;
          const nw = nearestWall(baseFloor, world, 30 * px);
          const wallId = nw?.wallId ?? bo.wallId;
          const w = baseFloor.walls.find((x) => x.id === wallId)!;
          const along = projectOnSegment(world, w.a, w.b).along;
          const others = baseFloor.openings.filter((o) => o.wallId === wallId && o.id !== bo.id);
          const c = clampOpening(gridOn ? Math.round(along) : along, bo.width, wallLength(w), others);
          if (c == null) return;
          api().dragUpdate((_, f) => {
            const o = f.openings.find((x) => x.id === d.id)!;
            o.wallId = wallId;
            o.offset = Math.round(c * 10) / 10;
          });
          return;
        }
        case 'room': {
          const br = baseFloor.rooms.find((x) => x.id === d.id);
          if (!br) return;
          api().dragUpdate((_, f) => {
            const r = f.rooms.find((x) => x.id === d.id)!;
            r.polygon = br.polygon.map((p) => add(p, gridDelta));
          });
          return;
        }
        case 'roomVertex': {
          const s = doSnap(world);
          setCursor(s.p);
          setSnapKind(s.kind);
          api().dragUpdate((_, f) => {
            const r = f.rooms.find((x) => x.id === d.id)!;
            r.polygon[d.index!] = s.p;
          });
          return;
        }
        case 'dimension': {
          const bd = baseFloor.dimensions.find((x) => x.id === d.id);
          if (!bd) return;
          api().dragUpdate((_, f) => {
            const dm = f.dimensions.find((x) => x.id === d.id)!;
            dm.a = add(bd.a, gridDelta);
            dm.b = add(bd.b, gridDelta);
          });
          return;
        }
      }
      return;
    }

    // pré-visualizações
    let s;
    if (tool === 'wall') s = doSnap(world, chain[chain.length - 1], chain);
    else if (tool === 'roomPoly') s = doSnap(world, poly[poly.length - 1], poly);
    else if (tool === 'dimension') s = doSnap(world, dimStart);
    else if (tool === 'room') s = doSnap(world, rectStart ? null : null);
    else s = { p: world, kind: 'free' };
    setCursor(s.p);
    setSnapKind(s.kind);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d) {
      drag.current = null;
      if (d.mode !== 'pan') {
        if (d.moved) api().endDrag();
        else api().cancelDrag();
      }
    }
    if (tool === 'room' && rectStart) {
      const s = doSnap(toWorld(e.clientX, e.clientY));
      const a = rectStart;
      const b = s.p;
      setRectStart(null);
      if (Math.abs(a.x - b.x) > 10 && Math.abs(a.y - b.y) > 10) {
        const x0 = Math.min(a.x, b.x);
        const x1 = Math.max(a.x, b.x);
        const y0 = Math.min(a.y, b.y);
        const y1 = Math.max(a.y, b.y);
        createRoom([
          { x: x0, y: y0 },
          { x: x1, y: y0 },
          { x: x1, y: y1 },
          { x: x0, y: y1 },
        ]);
      }
    }
    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setChain([]);
    setPoly([]);
    setRectStart(null);
    setDimStart(null);
    setTyped('');
    if (tool !== 'select') api().setTool('select');
  };

  // ───────────────────────── render ─────────────────────────
  const vb = size.w ? `${view.cx - size.w / 2 / view.scale} ${view.cy - size.h / 2 / view.scale} ${size.w / view.scale} ${size.h / view.scale}` : '0 0 100 100';
  const sel = selection?.id ?? null;

  const minorPx = gridCm * view.scale;
  const showMinor = minorPx >= 6;

  const ghostOpening = useMemo(() => {
    if (!cursor || !(tool === 'door' || tool === 'window' || tool === 'gap')) return null;
    const nw = nearestWall(floor, cursor, 14 * px);
    if (!nw) return null;
    const w = floor.walls.find((x) => x.id === nw.wallId)!;
    const def = OPENING_DEFAULTS[tool];
    const others = floor.openings.filter((o) => o.wallId === w.id);
    const c = clampOpening(nw.along, def.width, wallLength(w), others);
    if (c == null) return null;
    return { wall: w, o: { id: 'ghost', wallId: w.id, kind: tool, offset: c, width: def.width, height: def.height, sill: def.sill, hinge: 'left' as const, flip: false, color: def.color } };
  }, [cursor, tool, floor, px]);

  const selectedWall = selection?.kind === 'wall' ? floor.walls.find((w) => w.id === selection.id) : undefined;
  const selectedRoom = selection?.kind === 'room' ? floor.rooms.find((w) => w.id === selection.id) : undefined;
  const selectedFurn = selection?.kind === 'furniture' ? floor.furniture.find((w) => w.id === selection.id) : undefined;
  const selectedOpening = selection?.kind === 'opening' ? floor.openings.find((w) => w.id === selection.id) : undefined;

  const lastChain = chain[chain.length - 1];
  const scaleBar = niceScaleBar(px);

  const cursorStyle = drag.current?.mode === 'pan' || space || tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair';

  return (
    <div className="canvas2d" ref={wrapRef}>
      <svg
        id="plan-svg"
        ref={svgRef}
        width={size.w}
        height={size.h}
        viewBox={vb}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => !drag.current && setCursor(null)}
        onDoubleClick={() => {
          if (tool === 'wall') setChain([]);
          if (tool === 'roomPoly' && poly.length >= 3) {
            createRoom(poly);
            setPoly([]);
          }
        }}
        onContextMenu={onContextMenu}
        style={{ cursor: cursorStyle }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="grid-minor" width={gridCm} height={gridCm} patternUnits="userSpaceOnUse">
            <path d={`M ${gridCm} 0 L 0 0 0 ${gridCm}`} fill="none" stroke="#e7e9ee" strokeWidth={px} />
          </pattern>
          <pattern id="grid-major" width={100} height={100} patternUnits="userSpaceOnUse">
            {showMinor && <rect width={100} height={100} fill="url(#grid-minor)" />}
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#d3d7df" strokeWidth={px} />
          </pattern>
        </defs>
        <rect
          className="no-export"
          x={view.cx - size.w / 2 / view.scale}
          y={view.cy - size.h / 2 / view.scale}
          width={size.w / view.scale}
          height={size.h / view.scale}
          fill="url(#grid-major)"
        />
        {below && (
          <g className="no-export">
            <GhostFloor floor={below} />
          </g>
        )}
        <RoomsLayer floor={floor} px={px} selectedId={sel} onDown={onEntityDown} />
        <FurnitureLayer floor={floor} px={px} selectedId={sel} onDown={onEntityDown} />
        <WallsLayer floor={floor} px={px} selectedId={sel} onDown={onEntityDown} />
        <OpeningsLayer floor={floor} px={px} selectedId={sel} onDown={onEntityDown} />
        <RoomLabels rooms={floor.rooms} px={px} />
        <WallDimensions walls={floor.walls} px={px} />
        <ManualDimensions dims={floor.dimensions} px={px} selectedId={sel} onDown={onEntityDown} />

        {/* ── seleção ── */}
        <g className="no-export">
          {selectedOpening &&
            (() => {
              const w = floor.walls.find((x) => x.id === selectedOpening.wallId);
              if (!w) return null;
              const L = wallLength(w);
              const u0 = selectedOpening.offset - selectedOpening.width / 2;
              const u1 = selectedOpening.offset + selectedOpening.width / 2;
              const off = w.thickness / 2 + 30 * px;
              return (
                <g>
                  {u0 > 1 && <DimensionLine a={w.a} b={add(w.a, scale(norm(sub(w.b, w.a)), u0))} px={px} offset={off} color="#2f6fed" />}
                  {L - u1 > 1 && <DimensionLine a={add(w.a, scale(norm(sub(w.b, w.a)), u1))} b={w.b} px={px} offset={off} color="#2f6fed" />}
                </g>
              );
            })()}
          {selectedWall &&
            [selectedWall.a, selectedWall.b].map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={6 * px}
                fill="#fff"
                stroke="var(--accent)"
                strokeWidth={2 * px}
                style={{ cursor: 'move' }}
                onPointerDown={(e) => onHandleDown(e, { mode: 'node', from: { ...p } })}
              />
            ))}
          {selectedRoom &&
            selectedRoom.polygon.map((p, i) => (
              <rect
                key={i}
                x={p.x - 5 * px}
                y={p.y - 5 * px}
                width={10 * px}
                height={10 * px}
                fill="#fff"
                stroke="var(--accent)"
                strokeWidth={2 * px}
                style={{ cursor: 'move' }}
                onPointerDown={(e) => onHandleDown(e, { mode: 'roomVertex', id: selectedRoom.id, index: i })}
              />
            ))}
          {selectedFurn &&
            (() => {
              const r = (selectedFurn.rotation * Math.PI) / 180;
              const dd = selectedFurn.d / 2 + 22 * px;
              const hx = selectedFurn.x + Math.sin(r) * dd;
              const hy = selectedFurn.y - Math.cos(r) * dd;
              const ex = selectedFurn.x + Math.sin(r) * (selectedFurn.d / 2);
              const ey = selectedFurn.y - Math.cos(r) * (selectedFurn.d / 2);
              return (
                <g>
                  <line x1={ex} y1={ey} x2={hx} y2={hy} stroke="var(--accent)" strokeWidth={1.5 * px} />
                  <circle
                    cx={hx}
                    cy={hy}
                    r={6 * px}
                    fill="var(--accent)"
                    stroke="#fff"
                    strokeWidth={2 * px}
                    style={{ cursor: 'grab' }}
                    onPointerDown={(e) => onHandleDown(e, { mode: 'rotate', id: selectedFurn.id })}
                  />
                  <text x={selectedFurn.x} y={selectedFurn.y + selectedFurn.d / 2 + 18 * px} fontSize={11 * px} textAnchor="middle" fill="var(--accent)" className="halo" strokeWidth={3 * px}>
                    {selectedFurn.w} × {selectedFurn.d} cm
                  </text>
                </g>
              );
            })()}
        </g>

        {/* ── pré-visualizações das ferramentas ── */}
        <g className="no-export" pointerEvents="none">
          {tool === 'wall' && chain.length > 0 && (
            <>
              <polyline points={chain.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth={2 * px} />
              {cursor && lastChain && (
                <>
                  <line x1={lastChain.x} y1={lastChain.y} x2={cursor.x} y2={cursor.y} stroke="var(--accent)" strokeWidth={wallThickness} strokeOpacity={0.35} />
                  <line x1={lastChain.x} y1={lastChain.y} x2={cursor.x} y2={cursor.y} stroke="var(--accent)" strokeWidth={1.5 * px} strokeDasharray={`${6 * px} ${4 * px}`} />
                  <DimensionLine a={lastChain} b={cursor} px={px} offset={-(wallThickness / 2 + 16 * px)} color="#2f6fed" />
                </>
              )}
            </>
          )}
          {tool === 'room' && rectStart && cursor && (
            <>
              <rect
                x={Math.min(rectStart.x, cursor.x)}
                y={Math.min(rectStart.y, cursor.y)}
                width={Math.abs(cursor.x - rectStart.x)}
                height={Math.abs(cursor.y - rectStart.y)}
                fill="rgba(47,111,237,0.12)"
                stroke="var(--accent)"
                strokeWidth={api().roomCreatesWalls ? wallThickness : 2 * px}
                strokeOpacity={api().roomCreatesWalls ? 0.4 : 1}
              />
              <DimensionLine a={{ x: Math.min(rectStart.x, cursor.x), y: Math.min(rectStart.y, cursor.y) }} b={{ x: Math.max(rectStart.x, cursor.x), y: Math.min(rectStart.y, cursor.y) }} px={px} offset={-(wallThickness / 2 + 18 * px)} color="#2f6fed" />
              <DimensionLine a={{ x: Math.max(rectStart.x, cursor.x), y: Math.min(rectStart.y, cursor.y) }} b={{ x: Math.max(rectStart.x, cursor.x), y: Math.max(rectStart.y, cursor.y) }} px={px} offset={-(wallThickness / 2 + 18 * px)} color="#2f6fed" />
              <text x={(rectStart.x + cursor.x) / 2} y={(rectStart.y + cursor.y) / 2} fontSize={14 * px} textAnchor="middle" fill="var(--accent)" fontWeight={600} className="halo" strokeWidth={3 * px}>
                {fmtM2(Math.abs((cursor.x - rectStart.x) * (cursor.y - rectStart.y)))}
              </text>
            </>
          )}
          {tool === 'roomPoly' && poly.length > 0 && (
            <>
              <polygon points={[...poly, ...(cursor ? [cursor] : [])].map((p) => `${p.x},${p.y}`).join(' ')} fill="rgba(47,111,237,0.12)" stroke="var(--accent)" strokeWidth={2 * px} />
              {poly.length >= 2 && cursor && (
                <text x={cursor.x} y={cursor.y - 16 * px} fontSize={12 * px} textAnchor="middle" fill="var(--accent)" className="halo" strokeWidth={3 * px}>
                  {(cm2ToM2(polygonArea([...poly, cursor]))).toFixed(2).replace('.', ',')} m²
                </text>
              )}
              <circle cx={poly[0].x} cy={poly[0].y} r={7 * px} fill="none" stroke="var(--accent)" strokeWidth={2 * px} />
            </>
          )}
          {tool === 'dimension' && dimStart && cursor && <DimensionLine a={dimStart} b={cursor} px={px} color="#d0532c" />}
          {ghostOpening && <OpeningShape o={ghostOpening.o} wall={ghostOpening.wall} px={px} ghost />}
          {tool === 'furniture' && pendingCatalogId && cursor && CATALOG_BY_ID[pendingCatalogId] && (
            <g transform={`translate(${gridOn ? Math.round(cursor.x / 5) * 5 : cursor.x} ${gridOn ? Math.round(cursor.y / 5) * 5 : cursor.y}) rotate(${ghostRot})`}>
              <FurnitureSymbol f={{ catalogId: pendingCatalogId, w: CATALOG_BY_ID[pendingCatalogId].w, d: CATALOG_BY_ID[pendingCatalogId].d, color: CATALOG_BY_ID[pendingCatalogId].color }} px={px} ghost />
            </g>
          )}
          {cursor && ['wall', 'roomPoly', 'dimension', 'room'].includes(tool) && (
            <circle cx={cursor.x} cy={cursor.y} r={(snapKind === 'node' ? 6 : 4) * px} fill={snapKind === 'node' ? '#18a058' : snapKind === 'wall' ? '#e08a00' : 'var(--accent)'} stroke="#fff" strokeWidth={1.5 * px} />
          )}
        </g>
      </svg>

      {/* overlays HTML */}
      <div className="hint">{TOOL_HINTS[tool]}</div>
      {tool === 'wall' && chain.length > 0 && cursor && (
        <div className="typed-length">
          {typed ? (
            <>
              Comprimento: <b>{typed}</b> m <span>Enter ↵</span>
            </>
          ) : (
            <>
              {fmtM(dist(lastChain, cursor))} · digite a medida
            </>
          )}
        </div>
      )}
      <div className="scalebar">
        <div style={{ width: scaleBar * view.scale }} />
        <span>{scaleBar >= 100 ? `${scaleBar / 100} m` : `${scaleBar} cm`}</span>
      </div>
      {cursor && (
        <div className="coords">
          x {(cursor.x / 100).toFixed(2)} · y {(cursor.y / 100).toFixed(2)} m
        </div>
      )}
      <div className="zoom-ctrls">
        <button title="Aproximar" onClick={() => setView((v) => ({ ...v, scale: Math.min(10, v.scale * 1.25) }))}>
          +
        </button>
        <button title="Afastar" onClick={() => setView((v) => ({ ...v, scale: Math.max(0.05, v.scale / 1.25) }))}>
          −
        </button>
        <button title="Enquadrar tudo" onClick={fit}>
          ⤢
        </button>
      </div>
      {!floor.walls.length && !floor.rooms.length && tool === 'select' && (
        <div className="empty-hint">
          <b>Comece desenhando</b>
          <span>Use <kbd>C</kbd> para um cômodo retangular ou <kbd>W</kbd> para paredes livres. Ou abra um modelo pronto em <b>Projeto → Novo</b>.</span>
        </div>
      )}
    </div>
  );
}
