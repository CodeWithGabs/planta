import { useEffect, useRef, useState } from 'react';
import { currentFloor, showToast, useStore } from '../model/store';
import { downloadBlob, slug } from '../model/persistence';
import { export3dPng, exportPlanPng, exportPlanSvg } from '../editor2d/export';
import { Logo } from './ProjectDialog';
import type { ViewMode } from '../model/types';

export function TopBar({ onOpenProjects, saved }: { onOpenProjects: () => void; saved: boolean }) {
  const project = useStore((s) => s.project);
  const floorId = useStore((s) => s.floorId);
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const commit = useStore((s) => s.commit);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menu]);

  const floor = currentFloor(project, floorId);
  const need2d = () => {
    if (viewMode === '3d') {
      showToast('Mude para a vista 2D ou Dividida para exportar a planta.');
      return true;
    }
    return false;
  };
  const need3d = () => {
    if (viewMode === '2d') {
      showToast('Mude para a vista 3D ou Dividida para tirar a foto.');
      return true;
    }
    return false;
  };

  return (
    <header className="topbar">
      <div className="brand">
        <Logo /> <span>Planta</span>
      </div>
      <button className="ghost" onClick={onOpenProjects}>
        Projetos
      </button>
      <input
        className="proj-name"
        value={project.name}
        onChange={(e) => useStore.setState((s) => ({ project: { ...s.project, name: e.target.value } }))}
        onBlur={(e) => !e.target.value.trim() && commit((p) => (p.name = 'Sem nome'))}
        aria-label="Nome do projeto"
      />
      <span className={saved ? 'saved' : 'saved pending'}>{saved ? '✓ salvo no navegador' : 'salvando…'}</span>
      <div className="spacer" />
      <div className="btn-group">
        <button onClick={undo} disabled={!canUndo} title="Desfazer (Ctrl+Z)">
          ↶
        </button>
        <button onClick={redo} disabled={!canRedo} title="Refazer (Ctrl+Shift+Z)">
          ↷
        </button>
      </div>
      <div className="segmented view-switch">
        {(
          [
            ['2d', '2D'],
            ['split', '2D | 3D'],
            ['3d', '3D'],
          ] as [ViewMode, string][]
        ).map(([m, l]) => (
          <button key={m} className={viewMode === m ? 'on' : ''} onClick={() => setViewMode(m)}>
            {l}
          </button>
        ))}
      </div>
      <div className="menu-wrap" ref={menuRef}>
        <button className="primary" onClick={() => setMenu((v) => !v)}>
          Exportar ▾
        </button>
        {menu && (
          <div className="menu" onClick={() => setMenu(false)}>
            <button onClick={() => !need2d() && exportPlanPng(floor, project.name).then((ok) => !ok && showToast('A planta está vazia.'))}>Planta em PNG</button>
            <button onClick={() => !need2d() && !exportPlanSvg(floor, project.name) && showToast('A planta está vazia.')}>Planta em SVG (vetor)</button>
            <button onClick={() => !need3d() && export3dPng(project.name)}>Foto do 3D (PNG)</button>
            <hr />
            <button
              onClick={() => {
                downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), `${slug(project.name)}.planta.json`);
              }}
            >
              Arquivo do projeto (.json)
            </button>
            <button onClick={() => window.print()}>Imprimir…</button>
          </div>
        )}
      </div>
    </header>
  );
}
