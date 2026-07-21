import { useEffect, useState } from "react";
import { getClient, type Client } from "@solvingclub/core";
import { db } from "../db";
import { createClientUser, resetClientPassword } from "../functions";

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
    <div style={{ border: "1px solid #eee", padding: 12, marginBottom: 16 }}>
      <strong>Client login</strong>{" "}
      {client?.loginEmail
        ? (
          <>
            <span>— {client.loginEmail}</span>{" "}
            <button onClick={onReset}>reset password</button>
          </>
        )
        : (
          <>
            <span>— none yet</span>{" "}
            <button onClick={onCreate}>create login</button>
          </>
        )}
      {msg && <p role="status">{msg}</p>}
    </div>
  );
}
