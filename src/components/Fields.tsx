import { useState } from "react";
import type { ReactNode } from "react";
export function NumberField({
  label,
  value,
  onChange,
  step = 0.1,
  min,
  max,
  unit = "m",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayed = draft ?? String(Math.round(value * 10000) / 10000);
  function commit() {
    if (draft === null) return;
    const n = Number(draft.replace(",", "."));
    if (
      Number.isFinite(n) &&
      draft.trim() &&
      (min === undefined || n >= min) &&
      (max === undefined || n <= max)
    )
      onChange(n);
    setDraft(null);
  }
  return (
    <label className="field">
      <span>{label}</span>
      <div className="number-wrap">
        <input
          aria-label={label}
          type="number"
          value={displayed}
          min={min}
          max={max}
          step={step}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <small>{unit}</small>
      </div>
    </label>
  );
}
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="inspector-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
