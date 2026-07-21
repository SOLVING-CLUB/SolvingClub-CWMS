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
    <div style={{ marginLeft: 16 }}>
      <form onSubmit={onAdd} style={{ display: "flex", gap: 8 }}>
        <input placeholder="New application" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit">Add app</button>
      </form>
      <ul>
        {apps.map((a) => (
          <li key={a.id}>
            <Link to={`/clients/${clientId}/apps/${a.id}`} state={{ projectId, clientId }}>{a.name}</Link>
            {" "}
            <button onClick={async () => { await deleteApplication(db, a.id); await refresh(); }}>delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
