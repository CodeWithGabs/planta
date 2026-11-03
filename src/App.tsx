import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useStore } from './model/store';
import { lastProjectId, listProjects, loadProject, saveProject } from './model/persistence';
import { drawKeys } from './editor2d/keybus';
import Canvas2D from './editor2d/Canvas2D';
import { Toolbar } from './ui/Toolbar';
import { TopBar } from './ui/TopBar';
import { FloorsBar, RightPanel } from './ui/panels';
import { ProjectDialog } from './ui/ProjectDialog';
import type { Tool } from './model/types';

const Scene3D = lazy(() => import('./view3d/Scene3D'));

const TOOL_KEYS: Record<string, Tool> = { v: 'select', h: 'pan', w: 'wall', c: 'room', p: 'door', j: 'window', o: 'gap', m: 'dimension' };

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

export default function App() {
  const viewMode = useStore((s) => s.viewMode);
  const toast = useStore((s) => s.toast);
  const project = useStore((s) => s.project);
  const [dialog, setDialog] = useState<'first' | 'open' | null>(null);
  const [saved, setSaved] = useState(true);
  // só salva depois que um projeto real foi carregado ou escolhido
  const ready = useRef(false);

  // carrega o último projeto
  useEffect(() => {
    const id = lastProjectId();
    const p = id ? loadProject(id) : null;
    const fallback = !p && listProjects()[0] ? loadProject(listProjects()[0].id) : null;
    if (p ?? fallback) {
      useStore.getState().loadProject((p ?? fallback)!);
      ready.current = true;
    } else setDialog('first');
  }, []);

  // salvamento automático (com atraso)
  useEffect(() => {
    if (!ready.current || useStore.getState().dragBase) return;
    setSaved(false);
    const t = setTimeout(() => {
      const ok = saveProject(useStore.getState().project);
      setSaved(ok);
    }, 600);
    return () => clearTimeout(t);
  }, [project]);

  // atalhos globais
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const st = useStore.getState();
      if (st.firstPerson && st.viewMode !== '2d') return;
      if (drawKeys.handler?.(e)) {
        e.preventDefault();
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (mod && k === 'y') {
        e.preventDefault();
        st.redo();
        return;
      }
      if (mod && k === 'c') return st.copySelection();
      if (mod && k === 'v') return st.paste();
      if (mod && k === 'd') {
        e.preventDefault();
        st.copySelection();
        st.paste();
        return;
      }
      if (mod) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (st.selection) {
          e.preventDefault();
          st.deleteSelection();
        }
        return;
      }
      if (e.key === 'Escape') {
        st.setTool('select');
        st.select(null);
        return;
      }
      if (k === 'r' && st.selection?.kind === 'furniture') {
        st.rotateSelection(e.shiftKey ? -90 : 90);
        return;
      }
      if (k === 'c' && e.shiftKey) return st.setTool('roomPoly');
      if (TOOL_KEYS[k] && st.viewMode !== '3d') st.setTool(TOOL_KEYS[k]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const show2d = viewMode !== '3d';
  const show3d = viewMode !== '2d';

  return (
    <div className="app">
      <TopBar onOpenProjects={() => setDialog('open')} saved={saved} />
      <div className="main">
        <Toolbar disabled={!show2d} />
        <div className={`views ${viewMode}`}>
          {show2d && (
            <section className="pane pane2d">
              <Canvas2D />
              <FloorsBar />
            </section>
          )}
          {show3d && (
            <section className="pane pane3d">
              <Suspense fallback={<div className="loading">Carregando 3D…</div>}>
                <Scene3D />
              </Suspense>
              {!show2d && <FloorsBar />}
            </section>
          )}
        </div>
        <RightPanel />
      </div>
      {dialog && (
        <ProjectDialog
          first={dialog === 'first'}
          onClose={() => {
            ready.current = true;
            setDialog(null);
          }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
