import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import {
  listProjectsByClient, listApplicationsByProject, listTasks, updateTask,
  type Project, type Application, type Task,
} from "@solvingclub/core";
import { db } from "../db";
import { fb } from "../firebase";
import { Comments } from "../tasks/Comments";

function AppTasks({ application }: { application: Application }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  async function refresh() { setTasks(await listTasks(db, { applicationId: application.id })); }
  useEffect(() => { refresh(); }, [application.id]);

  return (
    <div style={{ marginLeft: 16 }}>
      <strong>{application.name}</strong>
      <table width="100%">
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td>{t.title}</td>
              <td>{t.status}</td>
              <td>
                priority{" "}
                <input type="number" min={1} max={5} value={t.priority} style={{ width: 48 }}
                  onChange={async (e) => { await updateTask(db, t.id, { priority: Number(e.target.value) }); await refresh(); }} />
              </td>
              <td>
                <button onClick={() => setOpen(open === t.id ? null : t.id)}>comments</button>
                {open === t.id && <Comments taskId={t.id} clientId={t.clientId} authorType="client" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectBlock({ project }: { project: Project }) {
  const [apps, setApps] = useState<Application[]>([]);
  useEffect(() => { listApplicationsByProject(db, project.id).then(setApps); }, [project.id]);
  return (
    <section style={{ border: "1px solid #eee", padding: 12, marginBottom: 12 }}>
      <h3>{project.name}</h3>
      {apps.map((a) => <AppTasks key={a.id} application={a} />)}
    </section>
  );
}

export function ClientPortal({ clientId }: { clientId: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  useEffect(() => { listProjectsByClient(db, clientId).then(setProjects); }, [clientId]);

  return (
    <div>
      <header style={{ display: "flex", gap: 12, padding: 12, borderBottom: "1px solid #ddd" }}>
        <strong>SolvingClub — Client Portal</strong>
        <span style={{ flex: 1 }} />
        <button onClick={() => signOut(fb.auth)}>Sign out</button>
      </header>
      <main style={{ padding: 16 }}>
        <h1>Your projects</h1>
        {projects.length === 0 && <p>No projects yet.</p>}
        {projects.map((p) => <ProjectBlock key={p.id} project={p} />)}
      </main>
    </div>
  );
}
