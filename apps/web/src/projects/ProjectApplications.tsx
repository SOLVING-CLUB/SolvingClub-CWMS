import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listApplicationsByProject, createApplication, deleteApplication, type Application,
} from "@solvingclub/core";
import { db } from "../db";

export function ProjectApplications({ projectId, clientId }: { projectId: string; clientId: string }) {
  const [apps, setApps] = useState<Application[]>([]);
  const [name, setName] = useState("");

  async function refresh() { setApps(await listApplicationsByProject(db, projectId)); }
  useEffect(() => { refresh(); }, [projectId]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createApplication(db, { projectId, clientId, name: name.trim() });
    setName(""); await refresh();
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
      <form onSubmit={onAdd} className="form-row" style={{ marginBottom: apps.length ? 8 : 0 }}>
        <input placeholder="New application" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
        <button type="submit">Add app</button>
      </form>
      {apps.map((a) => (
        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
          <Link to={`/clients/${clientId}/apps/${a.id}`} state={{ projectId, clientId }} style={{ fontWeight: 500 }}>
            {a.name}
          </Link>
          <span style={{ flex: 1 }} />
          <button onClick={async () => { await deleteApplication(db, a.id); await refresh(); }}>Delete</button>
        </div>
      ))}
    </div>
  );
}
