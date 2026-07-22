import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const PRIORITIES = [
  { value: 1, label: "Urgent", short: "P1", tone: "urgent" },
  { value: 2, label: "High", short: "P2", tone: "high" },
  { value: 3, label: "Normal", short: "P3", tone: "normal" },
  { value: 4, label: "Low", short: "P4", tone: "low" },
  { value: 5, label: "Someday", short: "P5", tone: "someday" },
] as const;

export function priorityMeta(priority: number) {
  return PRIORITIES.find((item) => item.value === priority) ?? PRIORITIES[2];
}

export function PriorityBadge({ value, compact = false }: { value: number; compact?: boolean }) {
  const item = priorityMeta(value);
  return (
    <span className={cn("priority-badge", `priority-${item.tone}`)} title={`Priority ${item.value}: ${item.label}`}>
      <i aria-hidden="true" />
      {compact ? item.short : item.label}
    </span>
  );
}

export function PrioritySelect({
  value, onChange, isDisabled = false, label = "Priority", className,
}: {
  value: number;
  onChange: (priority: number) => void | Promise<void>;
  isDisabled?: boolean;
  label?: string;
  className?: string;
}) {
  const current = priorityMeta(value);
  return (
    <Select
      aria-label={label}
      selectedKey={String(current.value)}
      isDisabled={isDisabled}
      onSelectionChange={(key) => void onChange(Number(key))}
      className={className}
    >
      <SelectTrigger size="sm" className="priority-trigger">
        <SelectValue><PriorityBadge value={current.value} /></SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-44">
        {PRIORITIES.map((item) => (
          <SelectItem key={item.value} id={String(item.value)} textValue={item.label}>
            <PriorityBadge value={item.value} />
            <span className="priority-hint">{item.value === 1 ? "Do first" : item.value === 5 ? "No urgency" : `Priority ${item.value}`}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
