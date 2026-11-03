import { currentFloor, moveNode, showToast, useStore, fixOpenings } from '../model/store';
import type { FloorMaterial, Furniture, Opening, Wall } from '../model/types';
import {
  add,
  clampOpening,
  cm2ToM2,
  dist,
  fmtM,
  fmtM2,
  polygonArea,
  polygonPerimeter,
  scale,
  uid,
  wallAngleDeg,
  wallDir,
  wallLength,
} from '../model/geometry';
import { CATALOG_BY_ID } from '../catalog/items';
import { MATERIAL_LABEL } from '../editor2d/layers';
import { ColorField, NumberField, Segmented, TextField } from './fields';

const KIND_LABEL: Record<Opening['kind'], string> = { door: 'Porta', window: 'Janela', gap: 'Vão' };

export function PropertiesPanel() {
  const project = useStore((s) => s.project);
  const floorId = useStore((s) => s.floorId);
  const selection = useStore((s) => s.selection);
  const commit = useStore((s) => s.commit);
  const select = useStore((s) => s.select);
  const del = useStore((s) => s.deleteSelection);
  const floor = currentFloor(project, floorId);

  if (!selection) return <ProjectSettings />;

  const DeleteBtn = (
    <button className="danger wide" onClick={del}>
      Excluir <kbd>Del</kbd>
    </button>
  );

  if (selection.kind === 'wall') {
    const w = floor.walls.find((x) => x.id === selection.id);
    if (!w) return null;
    const L = wallLength(w);
    const upd = (fn: (w: Wall) => void) =>
      commit((p, f) => {
        const x = f.walls.find((y) => y.id === w.id);
        if (x) fn(x);
        fixOpenings(p);
      });
    return (
      <div className="props">
        <h3>Parede</h3>
        <NumberField
          label="Comprimento"
          value={L}
          min={10}
          onChange={(v) =>
            commit((p, f) => {
              const nb = add(w.a, scale(wallDir(w), v));
              moveNode(f, w.b, nb);
              fixOpenings(p);
            })
          }
          title="Muda a posição da ponta final; paredes ligadas acompanham"
        />
        <NumberField label="Espessura" value={w.thickness} min={2} max={100} onChange={(v) => upd((x) => (x.thickness = v))} />
        <NumberField label="Altura" value={w.height} min={20} max={1000} onChange={(v) => upd((x) => (x.height = v))} />
        <div className="field">
          <span>Ângulo</span>
          <div className="readonly">{(((wallAngleDeg(w) % 360) + 360) % 360).toFixed(1).replace('.', ',')}°</div>
        </div>
        <ColorField label="Cor" value={w.color} onChange={(c) => upd((x) => (x.color = c))} />
        <div className="row-btns">
          <button
            onClick={() => {
              commit((_, f) => {
                const x = f.walls.find((y) => y.id === w.id)!;
                const mid = { x: Math.round(((x.a.x + x.b.x) / 2) * 10) / 10, y: Math.round(((x.a.y + x.b.y) / 2) * 10) / 10 };
                const half = dist(x.a, mid);
                const w2: Wall = { ...x, id: uid('wall'), a: { ...mid }, b: { ...x.b } };
                x.b = { ...mid };
                f.walls.push(w2);
                for (const o of f.openings) {
                  if (o.wallId !== x.id) continue;
                  if (o.offset > half) {
                    o.wallId = w2.id;
                    o.offset -= half;
                  }
                }
              });
              showToast('Parede dividida ao meio.');
            }}
            title="Cria um nó no meio para fazer junções em T"
          >
            Dividir ao meio
          </button>
          <button
            onClick={() =>
              commit((_, f) => {
                const x = f.walls.find((y) => y.id === w.id)!;
                const L2 = wallLength(x);
                [x.a, x.b] = [x.b, x.a];
                for (const o of f.openings) if (o.wallId === x.id) o.offset = L2 - o.offset;
              })
            }
            title="Troca início e fim (muda o lado das cotas)"
          >
            Inverter sentido
          </button>
        </div>
        {DeleteBtn}
      </div>
    );
  }

  if (selection.kind === 'opening') {
    const o = floor.openings.find((x) => x.id === selection.id);
    const w = o && floor.walls.find((x) => x.id === o.wallId);
    if (!o || !w) return null;
    const L = wallLength(w);
    const others = floor.openings.filter((x) => x.wallId === w.id && x.id !== o.id);
    const upd = (fn: (o: Opening) => void) =>
      commit((_, f) => {
        const x = f.openings.find((y) => y.id === o.id);
        if (x) fn(x);
      });
    const setWidth = (v: number) => {
      const c = clampOpening(o.offset, v, L, others);
      if (c == null) return showToast('Essa largura não cabe na parede.');
      upd((x) => {
        x.width = v;
        x.offset = c;
      });
    };
    return (
      <div className="props">
        <h3>{KIND_LABEL[o.kind]}</h3>
        <Segmented
          label="Tipo"
          value={o.kind}
          options={[
            { value: 'door', label: 'Porta' },
            { value: 'window', label: 'Janela' },
            { value: 'gap', label: 'Vão' },
          ]}
          onChange={(k) =>
            upd((x) => {
              x.kind = k;
              if (k === 'window' && x.sill === 0) {
                x.sill = 110;
                x.height = Math.min(110, w.height - 110);
                x.color = '#ffffff';
              }
              if (k !== 'window') {
                x.sill = 0;
                x.height = Math.min(210, w.height);
                if (k === 'door') x.color = '#b08a63';
              }
            })
          }
        />
        <NumberField label="Largura" value={o.width} min={20} max={L} onChange={setWidth} />
        <NumberField label="Altura" value={o.height} min={10} max={w.height - o.sill} onChange={(v) => upd((x) => (x.height = v))} />
        {o.kind === 'window' && <NumberField label="Peitoril" value={o.sill} min={0} max={w.height - o.height} onChange={(v) => upd((x) => (x.sill = v))} title="Altura da base da janela em relação ao piso" />}
        <NumberField
          label="Distância do início"
          value={o.offset - o.width / 2}
          min={0}
          max={L - o.width}
          onChange={(v) => {
            const c = clampOpening(v + o.width / 2, o.width, L, others);
            if (c == null) return showToast('Ali já existe outra abertura.');
            upd((x) => (x.offset = c));
          }}
          title="Distância da ponta inicial da parede até a lateral da abertura"
        />
        <div className="field">
          <span>Até o fim</span>
          <div className="readonly">{fmtM(L - o.offset - o.width / 2)}</div>
        </div>
        {o.kind === 'door' && (
          <>
            <Segmented
              label="Dobradiça"
              value={o.hinge}
              options={[
                { value: 'left', label: 'Esquerda' },
                { value: 'right', label: 'Direita' },
              ]}
              onChange={(h) => upd((x) => (x.hinge = h))}
            />
            <button className="wide" onClick={() => upd((x) => (x.flip = !x.flip))}>
              Inverter lado de abertura
            </button>
          </>
        )}
        {o.kind !== 'gap' && <ColorField label={o.kind === 'door' ? 'Cor da folha' : 'Cor do caixilho'} value={o.color} onChange={(c) => upd((x) => (x.color = c))} />}
        {DeleteBtn}
      </div>
    );
  }

  if (selection.kind === 'room') {
    const r = floor.rooms.find((x) => x.id === selection.id);
    if (!r) return null;
    const upd = (fn: (r: typeof floor.rooms[number]) => void) =>
      commit((_, f) => {
        const x = f.rooms.find((y) => y.id === r.id);
        if (x) fn(x);
      });
    return (
      <div className="props">
        <h3>Cômodo</h3>
        <TextField label="Nome" value={r.name} onChange={(v) => upd((x) => (x.name = v))} />
        <div className="field">
          <span>Área</span>
          <div className="readonly big">{fmtM2(polygonArea(r.polygon))}</div>
        </div>
        <div className="field">
          <span>Perímetro</span>
          <div className="readonly">{fmtM(polygonPerimeter(r.polygon))}</div>
        </div>
        <div className="field">
          <span>Piso</span>
          <div className="chips">
            {(Object.keys(MATERIAL_LABEL) as FloorMaterial[]).map((m) => (
              <button key={m} className={r.material === m ? 'chip on' : 'chip'} onClick={() => upd((x) => (x.material = m))}>
                {MATERIAL_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
        <p className="muted small">
          A área é medida pelo eixo das paredes. Arraste os quadradinhos dos cantos para ajustar o contorno. Área útil aproximada (descontando paredes de 15 cm):{' '}
          <b>{(cm2ToM2(polygonArea(r.polygon)) - (polygonPerimeter(r.polygon) / 100) * 0.075).toFixed(2).replace('.', ',')} m²</b>
        </p>
        {DeleteBtn}
      </div>
    );
  }

  if (selection.kind === 'furniture') {
    const f = floor.furniture.find((x) => x.id === selection.id);
    if (!f) return null;
    const item = CATALOG_BY_ID[f.catalogId];
    const upd = (fn: (x: Furniture) => void) =>
      commit((_, fl) => {
        const x = fl.furniture.find((y) => y.id === f.id);
        if (x) fn(x);
      });
    return (
      <div className="props">
        <h3>{item?.name ?? 'Móvel'}</h3>
        <div className="grid2">
          <NumberField label="Largura" value={f.w} min={5} onChange={(v) => upd((x) => (x.w = v))} />
          <NumberField label="Profund." value={f.d} min={5} onChange={(v) => upd((x) => (x.d = v))} />
          <NumberField label="Altura" value={f.h} min={1} onChange={(v) => upd((x) => (x.h = v))} />
          <NumberField label="Do piso" value={f.elevation} min={0} onChange={(v) => upd((x) => (x.elevation = v))} title="Altura da base (ex.: armário aéreo)" />
          <NumberField label="Posição X" value={f.x} onChange={(v) => upd((x) => (x.x = v))} />
          <NumberField label="Posição Y" value={f.y} onChange={(v) => upd((x) => (x.y = v))} />
        </div>
        <NumberField label="Rotação" unit="°" value={f.rotation} step={15} onChange={(v) => upd((x) => (x.rotation = ((v % 360) + 360) % 360))} />
        <div className="row-btns">
          <button onClick={() => upd((x) => (x.rotation = (x.rotation + 90) % 360))}>
            Girar 90° <kbd>R</kbd>
          </button>
          <button
            onClick={() => {
              const id = uid('fur');
              commit((_, fl) => fl.furniture.push({ ...f, id, x: f.x + 30, y: f.y + 30 }));
              select({ kind: 'furniture', id });
            }}
          >
            Duplicar <kbd>Ctrl D</kbd>
          </button>
        </div>
        {item && (f.w !== item.w || f.d !== item.d || f.h !== item.h) && (
          <button className="wide ghost" onClick={() => upd((x) => Object.assign(x, { w: item.w, d: item.d, h: item.h }))}>
            Voltar às medidas padrão ({item.w} × {item.d} × {item.h})
          </button>
        )}
        <ColorField label="Cor" value={f.color} onChange={(c) => upd((x) => (x.color = c))} />
        {DeleteBtn}
      </div>
    );
  }

  if (selection.kind === 'dimension') {
    const d = floor.dimensions.find((x) => x.id === selection.id);
    if (!d) return null;
    return (
      <div className="props">
        <h3>Cota</h3>
        <div className="field">
          <span>Medida</span>
          <div className="readonly big">{fmtM(dist(d.a, d.b))}</div>
        </div>
        {DeleteBtn}
      </div>
    );
  }
  return null;
}

function ProjectSettings() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const roomCreatesWalls = useStore((s) => s.roomCreatesWalls);
  const setS = useStore((s) => s.set);
  const st = project.settings;
  return (
    <div className="props">
      <h3>Configurações</h3>
      <p className="muted small">Nada selecionado. Clique em uma parede, abertura, cômodo ou móvel para editar as medidas.</p>
      <TextField label="Nome do projeto" value={project.name} onChange={(v) => commit((p) => (p.name = v))} />
      <Segmented
        label="Grade"
        value={String(st.gridCm) as '1' | '5' | '10' | '50'}
        options={[
          { value: '1', label: '1 cm' },
          { value: '5', label: '5 cm' },
          { value: '10', label: '10 cm' },
          { value: '50', label: '50 cm' },
        ]}
        onChange={(v) => commit((p) => (p.settings.gridCm = Number(v)))}
      />
      <label className="check">
        <input type="checkbox" checked={st.snap} onChange={(e) => commit((p) => (p.settings.snap = e.target.checked))} /> Encaixar na grade
      </label>
      <label className="check">
        <input type="checkbox" checked={roomCreatesWalls} onChange={(e) => setS('roomCreatesWalls', e.target.checked)} /> Cômodo desenhado cria paredes
      </label>
      <h4>Novas paredes</h4>
      <div className="grid2">
        <NumberField label="Espessura" value={st.wallThickness} min={2} max={100} onChange={(v) => commit((p) => (p.settings.wallThickness = v))} />
        <NumberField label="Altura" value={st.wallHeight} min={50} max={1000} onChange={(v) => commit((p) => (p.settings.wallHeight = v))} />
      </div>
      <h4>Atalhos</h4>
      <ul className="shortcuts">
        <li><kbd>V</kbd> Selecionar</li>
        <li><kbd>W</kbd> Parede</li>
        <li><kbd>C</kbd> Cômodo</li>
        <li><kbd>P</kbd> Porta · <kbd>J</kbd> Janela · <kbd>O</kbd> Vão</li>
        <li><kbd>M</kbd> Cota · <kbd>H</kbd> Mão</li>
        <li><kbd>Espaço</kbd> + arrastar: mover vista</li>
        <li><kbd>Ctrl Z</kbd> desfazer · <kbd>Ctrl Shift Z</kbd> refazer</li>
        <li><kbd>Ctrl C</kbd> / <kbd>Ctrl V</kbd> copiar/colar móvel</li>
      </ul>
    </div>
  );
}
