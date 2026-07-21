import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  listProjectsByClient, createProject, updateProject, deleteProject, type Project,
} from "@solvingclub/core";
import { db } from "../db";
import { ProjectApplications } from "../projects/ProjectApplications";
import { ClientLoginPanel } from "./ClientLoginPanel";
import { Documents } from "../documents/Documents";
import { InvoicesPanel } from "../invoices/InvoicesPanel";

export function ClientDetailPage() {
  const { clientId = "" } = useParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");

  async function refresh() { setProjects(await listProjectsByClient(db, clientId)); }
  useEffect(() => { refresh(); }, [clientId]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createProject(db, { clientId, name: name.trim() });
    setName(""); await refresh();
  }

  return (
    <div>
      <Link to="/clients" className="back-link">← Clients</Link>

      <ClientLoginPanel clientId={clientId} />
      <Documents ownerType="client" ownerId={clientId} clientId={clientId} canEdit />
      <InvoicesPanel clientId={clientId} canEdit />

      <h2>Projects</h2>
      <form onSubmit={onAdd} className="form-row" style={{ marginBottom: 16 }}>
        <input placeholder="New project" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
        <button type="submit">Add project</button>
      </form>

      {projects.length === 0 && <p className="empty-state">No projects yet.</p>}
      {projects.map((p) => (
        <section key={p.id} className="card">
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
            <strong style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>{p.name}</strong>
            <span style={{ flex: 1 }} />
            <button onClick={async () => {
              const next = prompt("Rename project", p.name);
              if (next && next.trim()) { await updateProject(db, p.id, { name: next.trim() }); await refresh(); }
            }}>Rename</button>
            <button onClick={async () => { await deleteProject(db, p.id); await refresh(); }}>Delete</button>
          </div>
          <ProjectApplications projectId={p.id} clientId={clientId} />
        </section>
      ))}
    </div>
  );
}
