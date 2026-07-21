import type { ReactNode } from "react";

export type StatusTone = "neutral" | "progress" | "blocked" | "done";

const TONE_VAR: Record<StatusTone, string> = {
  neutral: "var(--status-neutral)",
  progress: "var(--status-progress)",
  blocked: "var(--status-blocked)",
  done: "var(--status-done)",
};

export function StatusTag({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span className="status-tag" style={{ color: TONE_VAR[tone] }}>
      {children}
    </span>
  );
}

/** A StatusTag whose label is an editable <select> — same look, still interactive. */
export function StatusSelect<T extends string>(
  { value, tone, options, onChange }:
  { value: T; tone: StatusTone; options: readonly T[]; onChange: (v: T) => void },
) {
  return (
    <span className="status-tag" style={{ color: TONE_VAR[tone] }}>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
      </select>
    </span>
  );
}
