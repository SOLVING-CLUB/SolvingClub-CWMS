import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  listProjectsByClient, createProject, updateProject, deleteProject, type Project,
} from "@solvingclub/core";
import { db } from "../db";
import { ProjectApplications } from "../projects/ProjectApplications";
import { ClientLoginPanel } from "./ClientLoginPanel";

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
      <p><Link to="/clients">← Clients</Link></p>
      <ClientLoginPanel clientId={clientId} />
      <h1>Projects</h1>
      <form onSubmit={onAdd} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input placeholder="New project" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit">Add project</button>
      </form>
      {projects.map((p) => (
        <section key={p.id} style={{ border: "1px solid #eee", padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <strong>{p.name}</strong>
            <button onClick={async () => {
              const next = prompt("Rename project", p.name);
              if (next && next.trim()) { await updateProject(db, p.id, { name: next.trim() }); await refresh(); }
            }}>rename</button>
            <button onClick={async () => { await deleteProject(db, p.id); await refresh(); }}>delete</button>
          </div>
          <ProjectApplications projectId={p.id} clientId={clientId} />
        </section>
      ))}
    </div>
  );
}
