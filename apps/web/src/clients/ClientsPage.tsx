import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createClient, listClients, type Client } from "@solvingclub/core";
import { db } from "../db";

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setClients(await listClients(db));
  }
  useEffect(() => { refresh(); }, []);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim()) { setError("Name and email are required."); return; }
    await createClient(db, { name: name.trim(), email: email.trim() });
    setName(""); setEmail("");
    await refresh();
  }

  return (
    <div>
      <div className="eyebrow">Clients</div>
      <h1 style={{ marginBottom: 20 }}>{clients.length} client{clients.length === 1 ? "" : "s"}</h1>

      <form onSubmit={onAdd} className="form-row" style={{ marginBottom: 20 }}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1 }} />
        <button type="submit">Add client</button>
      </form>
      {error && <p role="alert" style={{ color: "var(--danger)", fontSize: 12 }}>{error}</p>}

      {clients.length === 0 ? (
        <p className="empty-state">No clients yet — add your first one above.</p>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {clients.map((c, i) => (
            <Link key={c.id} to={`/clients/${c.id}`} style={{
              display: "flex", alignItems: "baseline", gap: 12, padding: "12px 18px",
              borderBottom: i < clients.length - 1 ? "1px solid var(--line)" : "none",
              color: "var(--ink)",
            }}>
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              <span className="muted mono" style={{ fontSize: 12 }}>{c.email}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
