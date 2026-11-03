import { useRef, useState } from 'react';
import { TEMPLATES } from '../model/templates';
import { clone, newProject, showToast, useStore } from '../model/store';
import { deleteProject, listProjects, loadProject, saveProject, validateProject } from '../model/persistence';
import { boundsOf, uid, wallPolygon } from '../model/geometry';
import { useMemo } from 'react';
import { MATERIAL_FILL } from '../editor2d/layers';
import type { Project } from '../model/types';

function TemplateThumb({ make }: { make: () => Project }) {
  const f = useMemo(() => make().floors[0], [make]);
  const b = boundsOf(f.walls.flatMap((w) => [w.a, w.b]));
  const m = 40;
  return (
    <svg className="tpl-thumb" viewBox={`${b.minX - m} ${b.minY - m} ${b.maxX - b.minX + 2 * m} ${b.maxY - b.minY + 2 * m}`}>
      {f.rooms.map((r) => (
        <polygon key={r.id} points={r.polygon.map((p) => `${p.x},${p.y}`).join(' ')} fill={MATERIAL_FILL[r.material]} />
      ))}
      {f.furniture.map((it) => (
        <rect key={it.id} x={-it.w / 2} y={-it.d / 2} width={it.w} height={it.d} fill={it.color} opacity={0.7} transform={`translate(${it.x} ${it.y}) rotate(${it.rotation})`} />
      ))}
      {f.walls.map((w) => (
        <polygon key={w.id} points={wallPolygon(w, f.walls).map((p) => `${p.x},${p.y}`).join(' ')} fill="#3d4149" />
      ))}
    </svg>
  );
}

export function ProjectDialog({ onClose, first }: { onClose: () => void; first?: boolean }) {
  const load = useStore((s) => s.loadProject);
  const current = useStore((s) => s.project);
  const [tab, setTab] = useState<'new' | 'mine'>(first || !listProjects().length ? 'new' : 'mine');
  const [, force] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const projects = listProjects();

  const open = (p: ReturnType<typeof newProject>) => {
    const cur = useStore.getState().project;
    if (listProjects().some((m) => m.id === cur.id)) saveProject(cur);
    load(p);
    saveProject(p);
    onClose();
  };

  const importFile = async (file: File) => {
    try {
      const p = validateProject(JSON.parse(await file.text()));
      p.id = uid('proj');
      p.updatedAt = Date.now();
      open(p);
      showToast(`Projeto "${p.name}" importado.`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível ler o arquivo.');
    }
  };

  return (
    <div className="modal-bg" onPointerDown={(e) => e.target === e.currentTarget && !first && onClose()}>
      <div className="modal">
        <header>
          <div className="brand big">
            <Logo /> Planta
          </div>
          {!first && (
            <button className="icon" onClick={onClose} aria-label="Fechar">
              ✕
            </button>
          )}
        </header>
        {first && <p className="lead">Projete sua casa com medidas reais: paredes, portas, janelas e móveis, em planta 2D e em 3D. Tudo fica salvo neste navegador.</p>}
        <nav className="tabs">
          <button className={tab === 'new' ? 'on' : ''} onClick={() => setTab('new')}>
            Novo projeto
          </button>
          <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>
            Meus projetos ({projects.length})
          </button>
        </nav>
        {tab === 'new' ? (
          <div className="templates">
            <button className="tpl" onClick={() => open(newProject('Novo projeto'))}>
              <div className="tpl-thumb blank">+</div>
              <b>Em branco</b>
              <small>Comece do zero</small>
            </button>
            {TEMPLATES.map((t) => (
              <button key={t.id} className="tpl" onClick={() => open(t.make())}>
                <TemplateThumb make={t.make} />
                <b>{t.name}</b>
                <small>{t.desc}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="proj-list">
            {!projects.length && <p className="muted">Nenhum projeto salvo ainda.</p>}
            {projects.map((m) => (
              <div key={m.id} className={m.id === current.id ? 'proj on' : 'proj'}>
                <div>
                  <b>{m.name}</b>
                  <small>Editado {new Date(m.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</small>
                </div>
                <div className="row-btns">
                  <button
                    onClick={() => {
                      const p = m.id === current.id ? current : loadProject(m.id);
                      if (p) open(p);
                      else showToast('Não foi possível abrir este projeto.');
                    }}
                  >
                    Abrir
                  </button>
                  <button
                    onClick={() => {
                      const p = m.id === current.id ? current : loadProject(m.id);
                      if (!p) return;
                      const c = clone(p);
                      c.id = uid('proj');
                      c.name = `${p.name} (cópia)`;
                      c.updatedAt = Date.now();
                      saveProject(c);
                      force((x) => x + 1);
                    }}
                  >
                    Duplicar
                  </button>
                  <button
                    className="danger-text"
                    onClick={() => {
                      if (!confirm(`Excluir "${m.name}"? Isso não pode ser desfeito.`)) return;
                      deleteProject(m.id);
                      if (m.id === current.id) {
                        const np = newProject();
                        load(np);
                      }
                      force((x) => x + 1);
                    }}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <footer>
          <button className="ghost" onClick={() => fileRef.current?.click()}>
            Importar arquivo .json…
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
        </footer>
      </div>
    </div>
  );
}

export function Logo() {
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden>
      <path d="M4 15 16 4l12 11v13H4z" fill="var(--accent)" />
      <rect x="13" y="19" width="6" height="9" fill="#fff" />
      <rect x="8" y="16" width="4" height="4" fill="#fff" opacity=".8" />
    </svg>
  );
}
