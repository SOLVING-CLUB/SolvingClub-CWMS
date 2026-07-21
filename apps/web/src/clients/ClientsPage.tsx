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
      <h1>Clients</h1>
      <form onSubmit={onAdd} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit">Add client</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <ul>
        {clients.map((c) => (
          <li key={c.id}><Link to={`/clients/${c.id}`}>{c.name}</Link> — {c.email}</li>
        ))}
      </ul>
    </div>
  );
}
