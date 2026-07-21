import { Fragment, useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import {
  listProjectsByClient, listApplicationsByProject, listTasks, updateTask, listClientNotifications,
  getClient, type Project, type Application, type Task, type TaskStatus, type Client,
} from "@solvingclub/core";
import { db } from "../db";
import { fb } from "../firebase";
import { Comments } from "../tasks/Comments";
import { Documents } from "../documents/Documents";
import { NotificationBell } from "../notifications/NotificationBell";
import { InvoicesPanel } from "../invoices/InvoicesPanel";
import { StatusTag, type StatusTone } from "../ui/StatusTag";

const STATUS_TONE: Record<TaskStatus, StatusTone> = {
  todo: "neutral", in_progress: "progress", blocked: "blocked", done: "done",
};

function AppTasks({ application }: { application: Application }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  async function refresh() { setTasks(await listTasks(db, { applicationId: application.id })); }
  useEffect(() => { refresh(); }, [application.id]);

  if (tasks.length === 0) return null;

  return (
    <div style={{ marginTop: 10 }}>
      <div className="eyebrow">{application.name}</div>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <tbody>
            {tasks.map((t, i) => (
              <Fragment key={t.id}>
                <tr style={{ borderBottom: i === tasks.length - 1 && open !== t.id ? "none" : undefined }}>
                  <td style={{ paddingLeft: 16, fontWeight: 500 }}>{t.title}</td>
                  <td><StatusTag tone={STATUS_TONE[t.status]}>{t.status.replace("_", " ")}</StatusTag></td>
                  <td>
                    <span className="muted" style={{ fontSize: 11, marginRight: 6 }}>Priority</span>
                    <input type="number" min={1} max={5} value={t.priority} className="mono" style={{ width: 44 }}
                      onChange={async (e) => { await updateTask(db, t.id, { priority: Number(e.target.value) }); await refresh(); }} />
                  </td>
                  <td style={{ paddingRight: 16, textAlign: "right" }}>
                    <button onClick={() => setOpen(open === t.id ? null : t.id)}>
                      {open === t.id ? "Hide" : "Discuss"}
                    </button>
                  </td>
                </tr>
                {open === t.id && (
                  <tr>
                    <td colSpan={4} style={{ padding: "0 16px 14px", background: "var(--bg)" }}>
                      <Comments taskId={t.id} clientId={t.clientId} authorType="client" />
                      <Documents ownerType="task" ownerId={t.id} clientId={t.clientId} canEdit={false} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectBlock({ project }: { project: Project }) {
  const [apps, setApps] = useState<Application[]>([]);
  useEffect(() => { listApplicationsByProject(db, project.id).then(setApps); }, [project.id]);
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ marginTop: 0 }}>{project.name}</h2>
      {apps.map((a) => <AppTasks key={a.id} application={a} />)}
    </section>
  );
}

export function ClientPortal({ clientId }: { clientId: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  useEffect(() => { listProjectsByClient(db, clientId).then(setProjects); }, [clientId]);
  useEffect(() => { getClient(db, clientId).then(setClient); }, [clientId]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand wordmark">SolvingClub</div>
        <div className="sidebar-label">Portal</div>
        <div className="sidebar-link active" style={{ cursor: "default" }}>Overview</div>

        <div className="sidebar-footer">
          <NotificationBell fetchNotifications={() => listClientNotifications(db, clientId)} />
          <div className="sidebar-identity">{client?.name ?? "…"}</div>
          <div className="sidebar-identity mono" style={{ fontSize: 11 }}>{fb.auth.currentUser?.email}</div>
          <button onClick={() => signOut(fb.auth)}>Sign out</button>
        </div>
      </aside>

      <div className="app-main">
        <main className="page">
          <InvoicesPanel clientId={clientId} canEdit={false} />
          <h1 style={{ marginTop: 28 }}>Your projects</h1>
          {projects.length === 0 && <p className="empty-state">No projects yet.</p>}
          {projects.map((p) => <ProjectBlock key={p.id} project={p} />)}
        </main>
      </div>
    </div>
  );
}
