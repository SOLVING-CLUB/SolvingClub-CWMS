import { Fragment, useCallback, useEffect, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import {
  listTasks, createTask, updateTask, deleteTask, listMembers,
  type Task, type Member, type TaskStatus,
} from "@solvingclub/core";
import { db } from "../db";
import { fb } from "../firebase";
import { TaskForm } from "./TaskForm";
import { Comments } from "./Comments";
import { Documents } from "../documents/Documents";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];

export function TasksPage() {
  const { applicationId = "", clientId = "" } = useParams();
  const state = (useLocation().state ?? {}) as { projectId?: string; clientId?: string };
  const projectId = state.projectId ?? "";
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [openComments, setOpenComments] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setTasks(await listTasks(db, {
      applicationId,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(assigneeFilter ? { assigneeUid: assigneeFilter } : {}),
    }));
  }, [applicationId, statusFilter, assigneeFilter]);

  useEffect(() => { listMembers(db).then(setMembers); }, []);
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div>
      <p><Link to={`/clients/${clientId}`}>← Projects</Link></p>
      <h1>Tasks</h1>

      <TaskForm members={members} onSubmit={async (v) => {
        await createTask(db, {
          applicationId, projectId, clientId,
          createdBy: fb.auth.currentUser?.uid ?? "unknown",
          title: v.title, priority: v.priority,
          ...(v.assigneeUid ? { assigneeUid: v.assigneeUid } : {}),
          ...(v.dueDate ? { dueDate: v.dueDate } : {}),
        });
        await refresh();
      }} />

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "")}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
          <option value="">All assignees</option>
          {members.map((m) => <option key={m.uid} value={m.uid}>{m.name}</option>)}
        </select>
      </div>

      <table width="100%">
        <thead>
          <tr><th align="left">Title</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due</th><th></th></tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <Fragment key={t.id}>
              <tr>
                <td>{t.title}</td>
                <td>
                  <select value={t.status}
                    onChange={async (e) => { await updateTask(db, t.id, { status: e.target.value as TaskStatus }); await refresh(); }}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>
                  <input type="number" min={1} max={5} value={t.priority} style={{ width: 48 }}
                    onChange={async (e) => { await updateTask(db, t.id, { priority: Number(e.target.value) }); await refresh(); }} />
                </td>
                <td>
                  <select value={t.assigneeUid ?? ""}
                    onChange={async (e) => { await updateTask(db, t.id, { assigneeUid: e.target.value }); await refresh(); }}>
                    <option value="">Unassigned</option>
                    {members.map((m) => <option key={m.uid} value={m.uid}>{m.name}</option>)}
                  </select>
                </td>
                <td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}</td>
                <td>
                  <button onClick={() => setOpenComments(openComments === t.id ? null : t.id)}>comments</button>{" "}
                  <button onClick={async () => { await deleteTask(db, t.id); await refresh(); }}>delete</button>
                </td>
              </tr>
              {openComments === t.id && (
                <tr>
                  <td colSpan={6}>
                    <Comments taskId={t.id} clientId={t.clientId} authorType="member" />
                    <Documents ownerType="task" ownerId={t.id} clientId={t.clientId} canEdit />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
