import type { Tool } from '../model/types';
import { useStore } from '../model/store';

const I = {
  select: <path d="M5 3l14 8-6 1.5L10 19z" />,
  pan: <path d="M8 13V5.5a1.5 1.5 0 013 0V12m0-1V4.5a1.5 1.5 0 013 0V12m0-6.5a1.5 1.5 0 013 0V13m0-4.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1.5a6 6 0 01-5.2-3L5 14.5a1.5 1.5 0 012.6-1.5L8 14" />,
  wall: (
    <>
      <path d="M3 18L10 6l11 0" strokeWidth={4} strokeLinecap="square" />
    </>
  ),
  room: (
    <>
      <rect x="4" y="5" width="16" height="14" strokeWidth={2.6} />
      <path d="M9 12h6M12 9v6" strokeWidth={1.4} />
    </>
  ),
  roomPoly: <path d="M4 6l9-2 7 7-3 9H6z" strokeWidth={2.4} />,
  door: (
    <>
      <path d="M3 20h18" strokeWidth={2.4} />
      <path d="M6 20V8" strokeWidth={2.2} />
      <path d="M6 8a12 12 0 0112 12" strokeDasharray="2 2" />
    </>
  ),
  window: (
    <>
      <rect x="3" y="9" width="18" height="6" />
      <path d="M3 12h18" />
      <path d="M1 12h2M21 12h2" strokeWidth={3} />
    </>
  ),
  gap: (
    <>
      <path d="M2 12h6M16 12h6" strokeWidth={4} />
      <path d="M8 8v8M16 8v8" strokeDasharray="2 2" />
    </>
  ),
  dimension: (
    <>
      <path d="M4 12h16M4 8v8M20 8v8" />
      <path d="M7 10l-3 2 3 2M17 10l3 2-3 2" />
    </>
  ),
};

const TOOLS: { id: Tool; label: string; key: string; icon: JSX.Element; group?: boolean }[] = [
  { id: 'select', label: 'Selecionar', key: 'V', icon: I.select },
  { id: 'pan', label: 'Mover vista', key: 'H', icon: I.pan },
  { id: 'wall', label: 'Parede', key: 'W', icon: I.wall, group: true },
  { id: 'room', label: 'Cômodo retangular', key: 'C', icon: I.room },
  { id: 'roomPoly', label: 'Cômodo livre (polígono)', key: 'Shift C', icon: I.roomPoly },
  { id: 'door', label: 'Porta', key: 'P', icon: I.door, group: true },
  { id: 'window', label: 'Janela', key: 'J', icon: I.window },
  { id: 'gap', label: 'Vão (abertura sem porta)', key: 'O', icon: I.gap },
  { id: 'dimension', label: 'Cota / medir', key: 'M', icon: I.dimension, group: true },
];

export function Toolbar({ disabled }: { disabled?: boolean }) {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const setS = useStore((s) => s.set);
  return (
    <aside className={disabled ? 'toolbar disabled' : 'toolbar'}>
      {TOOLS.map((t) => (
        <div key={t.id} className={t.group ? 'tool-wrap sep' : 'tool-wrap'}>
          <button className={tool === t.id ? 'tool on' : 'tool'} onClick={() => setTool(t.id)} disabled={disabled} aria-label={t.label}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round">
              {t.icon}
            </svg>
          </button>
          <span className="tip">
            {t.label} <kbd>{t.key}</kbd>
          </span>
        </div>
      ))}
      <div className="tool-wrap sep">
        <button
          className={tool === 'furniture' ? 'tool on' : 'tool'}
          onClick={() => setS('rightTab', 'catalog')}
          disabled={disabled}
          aria-label="Móveis"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round">
            <path d="M4 11V8a3 3 0 013-3h10a3 3 0 013 3v3" />
            <path d="M3 11h18v5H3zM5 16v3M19 16v3" />
          </svg>
        </button>
        <span className="tip">Móveis (catálogo)</span>
      </div>
    </aside>
  );
}
