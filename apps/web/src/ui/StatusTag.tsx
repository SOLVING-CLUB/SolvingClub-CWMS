import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export type StatusTone = "neutral" | "progress" | "blocked" | "done";

const TONE_VAR: Record<StatusTone, string> = {
  neutral: "var(--status-neutral)",
  progress: "var(--status-progress)",
  blocked: "var(--status-blocked)",
  done: "var(--status-done)",
};

export function StatusTag({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <Badge variant="outline" className="gap-1.5 rounded-md px-2 py-1 font-mono text-xs uppercase tracking-wide" style={{ color: TONE_VAR[tone] }}><span className="size-2 rounded-full bg-current" />{children}</Badge>;
}

/** A StatusTag whose label is an editable <select> — same look, still interactive. */
export function StatusSelect<T extends string>(
  { value, tone, options, onChange, isDisabled }:
  { value: T; tone: StatusTone; options: readonly T[]; onChange: (v: T) => void; isDisabled?: boolean },
) {
  return (
    <NativeSelect disabled={isDisabled} value={value} onChange={(e) => onChange(e.target.value as T)} className="status-native-select h-8 w-auto font-mono uppercase" style={{ color: TONE_VAR[tone] }}>
      {options.map((o) => <NativeSelectOption key={o} value={o}>{o.replace(/_/g, " ")}</NativeSelectOption>)}
    </NativeSelect>
  );
}
