import { useEffect, useState } from "react";
import { subscribeClient, type Client } from "@solvingclub/core";
import { db } from "../db";
import { createClientUser, resetClientPassword } from "../functions";
import { StatusTag } from "../ui/StatusTag";
import { PasswordInput } from "../ui/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KeyRound, UserRoundPlus } from "lucide-react";

type Mode = "create" | "reset" | null;

export function ClientLoginPanel({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<Client | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeClient(db, clientId, setClient, () => setClient(null)), [clientId]);

  function open(next: Exclude<Mode, null>) {
    setMode(next); setEmail(client?.email ?? ""); setPassword(""); setError(null); setMessage(null);
  }

  async function save() {
    if (!mode || password.length < 6 || (mode === "create" && !email.includes("@"))) return;
    setBusy(true); setError(null);
    try {
      if (mode === "create") await createClientUser({ clientId, email: email.trim(), password });
      else await resetClientPassword({ clientId, newPassword: password });
      setMessage(mode === "create" ? "Client portal access created." : "Client password updated.");
      setMode(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Portal access could not be updated.");
    } finally { setBusy(false); }
  }

  return <>
    <Card className="access-card">
      <CardHeader className="border-b"><CardTitle>Portal access</CardTitle>{client?.loginEmail ? <StatusTag tone="done">Active</StatusTag> : <StatusTag tone="neutral">Not set</StatusTag>}</CardHeader>
      <CardContent className="access-card-body">
        {client?.loginEmail ? <><div><span>Login email</span><strong>{client.loginEmail}</strong></div><Button variant="outline" size="sm" onPress={() => open("reset")}><KeyRound /> Reset password</Button></>
          : <><p>Give this client read-only access to their work and invoices.</p><Button size="sm" onPress={() => open("create")}><UserRoundPlus /> Create login</Button></>}
        {message && <p role="status" className="form-message">{message}</p>}
      </CardContent>
    </Card>

    <Dialog isOpen={mode !== null} onOpenChange={(value) => !value && setMode(null)}>
      <DialogHeader><DialogTitle>{mode === "create" ? "Create client login" : "Reset client password"}</DialogTitle><DialogDescription>{mode === "create" ? "The client will sign in with this email and temporary password." : "The client’s existing sessions remain active until their token expires."}</DialogDescription></DialogHeader>
      <div className="dialog-form">
        {mode === "create" && <div><Label htmlFor="portal-email">Login email</Label><Input id="portal-email" type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></div>}
        <div><Label htmlFor="portal-password">{mode === "create" ? "Temporary password" : "New password"}</Label><PasswordInput key={mode} id="portal-password" autoFocus={mode === "reset"} autoComplete="new-password" value={password} toggleDisabled={busy} onChange={(e) => setPassword(e.target.value)} /><small>At least 6 characters.</small></div>
        {error && <p className="form-error">{error}</p>}
      </div>
      <DialogFooter showCloseButton><Button isDisabled={busy || password.length < 6 || (mode === "create" && !email.includes("@"))} onPress={save}>{busy ? "Saving…" : mode === "create" ? "Create login" : "Update password"}</Button></DialogFooter>
    </Dialog>
  </>;
}
