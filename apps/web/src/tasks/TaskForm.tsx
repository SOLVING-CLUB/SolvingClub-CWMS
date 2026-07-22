import { useId, useState } from "react";
import { type Member } from "@solvingclub/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { CalendarClock, Plus, UserRound } from "lucide-react";
import { PrioritySelect } from "../ui/PrioritySelect";

export type TaskFormValues = { title: string; priority: number; assigneeUid?: string; dueDate?: number };

export function TaskForm(
  { members, onSubmit, fixedAssigneeUid }: { members: Member[]; onSubmit: (v: TaskFormValues) => Promise<void>; fixedAssigneeUid?: string },
) {
  const fieldId = useId();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState(3);
  const [assigneeUid, setAssigneeUid] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true); setError(null);
    try {
      await onSubmit({
        title: title.trim(), priority,
        ...(fixedAssigneeUid || assigneeUid ? { assigneeUid: fixedAssigneeUid || assigneeUid } : {}),
        ...(due ? { dueDate: new Date(`${due}T12:00:00`).getTime() } : {}),
      });
      setTitle(""); setPriority(3); setAssigneeUid(""); setDue("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The task could not be created.");
    } finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="task-create-card">
    <header><div><strong>Create task</strong><small>Define the owner, urgency, and next deadline.</small></div><span>New work item</span></header>
    <div className="task-create-grid">
      <div className="task-create-title"><Label htmlFor={`${fieldId}-title`}>Task title</Label><Input id={`${fieldId}-title`} maxLength={240} placeholder="What needs to be delivered?" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div><Label>Priority</Label><PrioritySelect value={priority} onChange={setPriority} label="Task priority" className="task-priority-select" /></div>
      <div><Label htmlFor={`${fieldId}-assignee`}>Assignee</Label>{fixedAssigneeUid ? <span className="task-self-assignee"><UserRound /> Assigned to you</span> : <NativeSelect id={`${fieldId}-assignee`} value={assigneeUid} onChange={(e) => setAssigneeUid(e.target.value)}><NativeSelectOption value="">Unassigned</NativeSelectOption>{members.map((member) => <NativeSelectOption key={member.uid} value={member.uid}>{member.name}</NativeSelectOption>)}</NativeSelect>}</div>
      <div><Label htmlFor={`${fieldId}-due`}>Due date</Label><span className="task-date-field"><CalendarClock /><Input id={`${fieldId}-due`} type="date" min={new Date().toISOString().slice(0, 10)} value={due} onChange={(e) => setDue(e.target.value)} /></span></div>
    </div>
    {error && <p role="alert" className="form-error">{error}</p>}
    <footer><small>{title.length} / 240</small><Button type="submit" isDisabled={busy || !title.trim()}>{busy ? "Creating task…" : <><Plus /> Create task</>}</Button></footer>
  </form>;
}
