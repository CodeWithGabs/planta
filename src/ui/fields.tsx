import { useEffect, useState } from 'react';
import { parseLength } from '../model/geometry';

/** Campo numérico que confirma no Enter/blur. Unidade 'cm' aceita "3,45m" ou "80". */
export function NumberField({
  label,
  value,
  onChange,
  unit = 'cm',
  min,
  max,
  step = 1,
  disabled,
  title,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: 'cm' | '°' | 'm²' | '';
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  title?: string;
}) {
  const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');
  const [text, setText] = useState(fmt(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(fmt(value));
  }, [value, focused]);

  const commit = () => {
    let n: number | null;
    if (unit === 'cm') {
      const raw = text.trim().toLowerCase().replace(',', '.');
      // sem unidade = cm; com "m" = metros
      n = /m$/.test(raw) && !/cm$/.test(raw) ? parseLength(raw) : parseFloat(raw);
    } else n = parseFloat(text.replace(',', '.'));
    if (n == null || !isFinite(n)) {
      setText(fmt(value));
      return;
    }
    if (min != null) n = Math.max(min, n);
    if (max != null) n = Math.min(max, n);
    if (Math.abs(n - value) > 1e-6) onChange(n);
    setText(fmt(n));
  };

  return (
    <label className="field" title={title}>
      <span>{label}</span>
      <div className="input-unit">
        <input
          value={text}
          disabled={disabled}
          inputMode="decimal"
          onFocus={(e) => {
            setFocused(true);
            e.target.select();
          }}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setText(fmt(value));
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
              let n = value + delta;
              if (min != null) n = Math.max(min, n);
              if (max != null) n = Math.min(max, n);
              onChange(n);
            }
          }}
        />
        {unit && <em>{unit}</em>}
      </div>
    </label>
  );
}

export function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="field">
      <span>{label}</span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text.trim() && text !== value && onChange(text.trim())}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
}

const SWATCHES = ['#f2efe9', '#ffffff', '#e8e2d6', '#c9b8a3', '#a0764e', '#6e5038', '#3b3b3f', '#7a8b7f', '#8a8f99', '#5b6e7a', '#b85f4a', '#d9a441', '#4f8a4b', '#2f4b6e'];

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="swatches">
        {SWATCHES.map((c) => (
          <button key={c} className={c.toLowerCase() === value.toLowerCase() ? 'sw on' : 'sw'} style={{ background: c }} onClick={() => onChange(c)} title={c} />
        ))}
        <label className="sw custom" title="Outra cor">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        </label>
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="segmented">
        {options.map((o) => (
          <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
