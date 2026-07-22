import { useEffect, useState } from "react";
import { updateTask, type Member, type Task, type TaskStatus } from "@solvingclub/core";
import { db } from "../db";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PrioritySelect } from "../ui/PrioritySelect";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];

function toDateInput(value?: number) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function TaskEditDialog({
  task, members, canAssign, onOpenChange, onSaved,
}: {
  task: Task | null;
  members: Member[];
  canAssign: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState(3);
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title); setDescription(task.description ?? ""); setStatus(task.status);
    setPriority(task.priority); setAssignee(task.assigneeUid ?? ""); setDue(toDateInput(task.dueDate)); setError(null);
  }, [task]);

  async function save() {
    if (!task || !title.trim()) return;
    setBusy(true); setError(null);
    try {
      await updateTask(db, task.id, {
        title: title.trim(), description: description.trim() || null, status, priority,
        dueDate: due ? new Date(`${due}T12:00:00`).getTime() : null,
        ...(canAssign ? { assigneeUid: assignee || null } : {}),
      });
      await onSaved(); onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Task changes could not be saved.");
    } finally { setBusy(false); }
  }

  return (
    <Dialog isOpen={task !== null} onOpenChange={onOpenChange}>
      <DialogHeader><DialogTitle>Edit task</DialogTitle><DialogDescription>Keep ownership, urgency, and the next deadline clear.</DialogDescription></DialogHeader>
      <div className="dialog-form task-edit-grid">
        <div className="task-edit-title"><Label htmlFor="edit-task-title">Title</Label><Input id="edit-task-title" autoFocus maxLength={240} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="task-edit-description"><Label htmlFor="edit-task-description">Description</Label><Textarea id="edit-task-description" maxLength={4000} placeholder="Add the outcome, context, or acceptance criteria…" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div><Label htmlFor="edit-task-status">Status</Label><NativeSelect id="edit-task-status" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>{STATUSES.map((item) => <NativeSelectOption key={item} value={item}>{item.replace("_", " ")}</NativeSelectOption>)}</NativeSelect></div>
        <div><Label>Priority</Label><PrioritySelect value={priority} onChange={setPriority} className="task-edit-priority" /></div>
        {canAssign && <div><Label htmlFor="edit-task-assignee">Assignee</Label><NativeSelect id="edit-task-assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}><NativeSelectOption value="">Unassigned</NativeSelectOption>{members.map((member) => <NativeSelectOption key={member.uid} value={member.uid}>{member.name}</NativeSelectOption>)}</NativeSelect></div>}
        <div><Label htmlFor="edit-task-due">Due date</Label><Input id="edit-task-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        {error && <p className="form-error task-edit-error" role="alert">{error}</p>}
      </div>
      <DialogFooter showCloseButton><Button isDisabled={busy || !title.trim()} onPress={save}>{busy ? "Saving…" : "Save changes"}</Button></DialogFooter>
    </Dialog>
  );
}
