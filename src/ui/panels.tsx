import { useMemo, useState } from 'react';
import { CATALOG, CATEGORIES, type Category } from '../catalog/items';
import { FurnitureSymbol, MATERIAL_LABEL } from '../editor2d/layers';
import { currentFloor, newFloor, useStore } from '../model/store';
import { cm2ToM2, fmtM, polygonArea, wallLength } from '../model/geometry';
import { PropertiesPanel } from './PropertiesPanel';

export function CatalogPanel() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Category | 'Todos'>('Todos');
  const pending = useStore((s) => s.pendingCatalogId);
  const setPending = useStore((s) => s.setPendingCatalog);
  const items = useMemo(() => {
    const nq = q
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
    return CATALOG.filter(
      (i) =>
        (cat === 'Todos' || i.category === cat) &&
        (!nq ||
          i.name
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .includes(nq)),
    );
  }, [q, cat]);
  return (
    <div className="catalog">
      <input className="search" placeholder="Buscar móvel…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        {(['Todos', ...CATEGORIES] as const).map((c) => (
          <button key={c} className={cat === c ? 'chip on' : 'chip'} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="cat-grid">
        {items.map((i) => {
          const m = Math.max(i.w, i.d) * 0.62;
          return (
            <button key={i.id} className={pending === i.id ? 'cat-item on' : 'cat-item'} onClick={() => setPending(pending === i.id ? null : i.id)} title={`${i.name} — ${i.w} × ${i.d} × ${i.h} cm`}>
              <svg viewBox={`${-m} ${-m} ${2 * m} ${2 * m}`}>
                <FurnitureSymbol f={{ ...i, catalogId: i.id }} px={Math.max(i.w, i.d) / 80} />
              </svg>
              <b>{i.name}</b>
              <small>
                {i.w}×{i.d}×{i.h}
              </small>
            </button>
          );
        })}
        {!items.length && <p className="muted">Nada encontrado.</p>}
      </div>
      <p className="muted small">Clique num móvel e depois na planta para colocá-lo. Todas as medidas podem ser ajustadas depois.</p>
    </div>
  );
}

export function SummaryPanel() {
  const project = useStore((s) => s.project);
  let total = 0;
  return (
    <div className="summary">
      {project.floors.map((f) => {
        const area = f.rooms.reduce((s, r) => s + polygonArea(r.polygon), 0);
        total += area;
        const wallsLen = f.walls.reduce((s, w) => s + wallLength(w), 0);
        const count = (k: string) => f.openings.filter((o) => o.kind === k).length;
        const wallArea = f.walls.reduce((s, w) => s + wallLength(w) * w.height, 0) - f.openings.reduce((s, o) => s + o.width * o.height, 0);
        return (
          <section key={f.id}>
            <h3>{f.name}</h3>
            <table>
              <tbody>
                {f.rooms.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.name}
                      <small>{MATERIAL_LABEL[r.material]}</small>
                    </td>
                    <td className="num">{cm2ToM2(polygonArea(r.polygon)).toFixed(2).replace('.', ',')} m²</td>
                  </tr>
                ))}
                <tr className="total">
                  <td>Área do pavimento</td>
                  <td className="num">{cm2ToM2(area).toFixed(2).replace('.', ',')} m²</td>
                </tr>
              </tbody>
            </table>
            <dl>
              <dt>Paredes</dt>
              <dd>
                {f.walls.length} · {fmtM(wallsLen)}
              </dd>
              <dt>Área de parede (1 face)</dt>
              <dd>{cm2ToM2(Math.max(0, wallArea)).toFixed(1).replace('.', ',')} m²</dd>
              <dt>Portas / janelas / vãos</dt>
              <dd>
                {count('door')} / {count('window')} / {count('gap')}
              </dd>
              <dt>Móveis</dt>
              <dd>{f.furniture.length}</dd>
            </dl>
          </section>
        );
      })}
      {project.floors.length > 1 && (
        <div className="grand-total">
          Área total construída <b>{cm2ToM2(total).toFixed(2).replace('.', ',')} m²</b>
        </div>
      )}
      <p className="muted small">Áreas medidas pelo eixo das paredes. A área de parede ajuda a estimar tinta e revestimento.</p>
    </div>
  );
}

export function RightPanel() {
  const tab = useStore((s) => s.rightTab);
  const setS = useStore((s) => s.set);
  return (
    <aside className="right">
      <nav className="tabs">
        <button className={tab === 'props' ? 'on' : ''} onClick={() => setS('rightTab', 'props')}>
          Propriedades
        </button>
        <button className={tab === 'catalog' ? 'on' : ''} onClick={() => setS('rightTab', 'catalog')}>
          Móveis
        </button>
        <button className={tab === 'summary' ? 'on' : ''} onClick={() => setS('rightTab', 'summary')}>
          Resumo
        </button>
      </nav>
      <div className="panel-body">
        {tab === 'props' && <PropertiesPanel />}
        {tab === 'catalog' && <CatalogPanel />}
        {tab === 'summary' && <SummaryPanel />}
      </div>
    </aside>
  );
}

export function FloorsBar() {
  const project = useStore((s) => s.project);
  const floorId = useStore((s) => s.floorId);
  const setFloor = useStore((s) => s.setFloor);
  const commit = useStore((s) => s.commit);
  const active = currentFloor(project, floorId);
  return (
    <div className="floors">
      <span className="muted">Andares:</span>
      {project.floors.map((f) => (
        <button key={f.id} className={f.id === active.id ? 'chip on' : 'chip'} onClick={() => setFloor(f.id)} onDoubleClick={() => {
          const name = prompt('Nome do andar', f.name);
          if (name?.trim()) commit((p) => (p.floors.find((x) => x.id === f.id)!.name = name.trim()));
        }} title="Duplo-clique para renomear">
          {f.name}
        </button>
      ))}
      <button
        className="chip add"
        onClick={() => {
          const top = project.floors.reduce((a, b) => (b.elevation > a.elevation ? b : a));
          const nf = newFloor(`${project.floors.length}º andar`, top.elevation + top.height + 12, project.settings.wallHeight);
          commit((p) => p.floors.push(nf));
          setFloor(nf.id);
        }}
        title="Adiciona um andar acima"
      >
        + andar
      </button>
      {project.floors.length > 1 && (
        <button
          className="chip danger-text"
          onClick={() => {
            if (!confirm(`Excluir o andar "${active.name}" e tudo que há nele?`)) return;
            commit((p) => (p.floors = p.floors.filter((f) => f.id !== active.id)));
            setFloor(useStore.getState().project.floors[0].id);
          }}
        >
          Excluir andar
        </button>
      )}
    </div>
  );
}
