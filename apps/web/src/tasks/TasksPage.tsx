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
import { StatusSelect, type StatusTone } from "../ui/StatusTag";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];
const STATUS_TONE: Record<TaskStatus, StatusTone> = {
  todo: "neutral", in_progress: "progress", blocked: "blocked", done: "done",
};

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
      <Link to={`/clients/${clientId}`} className="back-link">← Projects</Link>
      <div className="eyebrow">Tasks</div>
      <h1 style={{ marginBottom: 18 }}>{tasks.length} task{tasks.length === 1 ? "" : "s"}</h1>

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

      <div className="form-row" style={{ marginBottom: 12 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "")}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
          <option value="">All assignees</option>
          {members.map((m) => <option key={m.uid} value={m.uid}>{m.name}</option>)}
        </select>
      </div>

      {tasks.length === 0 ? (
        <p className="empty-state">No tasks match. Add one above.</p>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ paddingLeft: 18 }}>Title</th><th>Status</th><th>Priority</th>
                <th>Assignee</th><th>Due</th><th style={{ paddingRight: 18 }}></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <Fragment key={t.id}>
                  <tr>
                    <td style={{ paddingLeft: 18, fontWeight: 500 }}>{t.title}</td>
                    <td>
                      <StatusSelect value={t.status} tone={STATUS_TONE[t.status]} options={STATUSES}
                        onChange={async (v) => { await updateTask(db, t.id, { status: v }); await refresh(); }} />
                    </td>
                    <td>
                      <input type="number" min={1} max={5} value={t.priority}
                        className="mono" style={{ width: 44, padding: "4px 6px" }}
                        onChange={async (e) => { await updateTask(db, t.id, { priority: Number(e.target.value) }); await refresh(); }} />
                    </td>
                    <td>
                      <select value={t.assigneeUid ?? ""}
                        onChange={async (e) => { await updateTask(db, t.id, { assigneeUid: e.target.value }); await refresh(); }}>
                        <option value="">Unassigned</option>
                        {members.map((m) => <option key={m.uid} value={m.uid}>{m.name}</option>)}
                      </select>
                    </td>
                    <td className="mono muted" style={{ fontSize: 12 }}>
                      {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ paddingRight: 18, textAlign: "right", whiteSpace: "nowrap" }}>
                      <button onClick={() => setOpenComments(openComments === t.id ? null : t.id)}>
                        {openComments === t.id ? "Hide" : "Discuss"}
                      </button>{" "}
                      <button onClick={async () => { await deleteTask(db, t.id); await refresh(); }}>Delete</button>
                    </td>
                  </tr>
                  {openComments === t.id && (
                    <tr>
                      <td colSpan={6} style={{ padding: "0 18px 16px", background: "var(--bg)" }}>
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
      )}
    </div>
  );
}
