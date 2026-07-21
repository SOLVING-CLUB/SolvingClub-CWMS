import { useState } from "react";
import { type Member } from "@solvingclub/core";

export type TaskFormValues = {
  title: string; priority: number; assigneeUid?: string; dueDate?: number;
};

export function TaskForm(
  { members, onSubmit }: { members: Member[]; onSubmit: (v: TaskFormValues) => Promise<void> },
) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState(3);
  const [assigneeUid, setAssigneeUid] = useState("");
  const [due, setDue] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await onSubmit({
      title: title.trim(), priority,
      ...(assigneeUid ? { assigneeUid } : {}),
      ...(due ? { dueDate: new Date(due).getTime() } : {}),
    });
    setTitle(""); setPriority(3); setAssigneeUid(""); setDue("");
  }

  return (
    <form onSubmit={submit} className="card form-row" style={{ marginBottom: 16 }}>
      <input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
      <input type="number" min={1} max={5} value={priority} className="mono" style={{ width: 56 }}
        onChange={(e) => setPriority(Number(e.target.value))} title="Priority (1=high)" />
      <select value={assigneeUid} onChange={(e) => setAssigneeUid(e.target.value)}>
        <option value="">Unassigned</option>
        {members.map((m) => <option key={m.uid} value={m.uid}>{m.name}</option>)}
      </select>
      <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      <button type="submit">Add task</button>
    </form>
  );
}
