import { useEffect, useState } from "react";
import { getClient, type Client } from "@solvingclub/core";
import { db } from "../db";
import { createClientUser, resetClientPassword } from "../functions";
import { StatusTag } from "../ui/StatusTag";

export function ClientLoginPanel({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<Client | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() { setClient(await getClient(db, clientId)); }
  useEffect(() => { refresh(); }, [clientId]);

  async function onCreate() {
    setMsg(null);
    const email = prompt("Client login email");
    if (!email) return;
    const password = prompt("Temporary password (min 6 chars)");
    if (!password) return;
    try {
      await createClientUser({ clientId, email, password });
      setMsg("Login created.");
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to create login.");
    }
  }

  async function onReset() {
    setMsg(null);
    const newPassword = prompt("New password (min 6 chars)");
    if (!newPassword) return;
    try {
      await resetClientPassword({ clientId, newPassword });
      setMsg("Password reset.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to reset password.");
    }
  }

  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span className="eyebrow" style={{ margin: 0 }}>Client login</span>
      {client?.loginEmail ? (
        <>
          <StatusTag tone="done">Active</StatusTag>
          <span className="mono muted" style={{ fontSize: 12 }}>{client.loginEmail}</span>
          <span style={{ flex: 1 }} />
          <button onClick={onReset}>Reset password</button>
        </>
      ) : (
        <>
          <StatusTag tone="neutral">None yet</StatusTag>
          <span style={{ flex: 1 }} />
          <button onClick={onCreate}>Create login</button>
        </>
      )}
      {msg && <p role="status" className="muted" style={{ fontSize: 12, marginLeft: 8 }}>{msg}</p>}
    </div>
  );
}
