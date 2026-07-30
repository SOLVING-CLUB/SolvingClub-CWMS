import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { subscribeClient, updateClient, type Client } from "@solvingclub/core";
import { ArrowLeft, Building2, CircleAlert, Save } from "lucide-react";
import { db } from "../db";
import { canAdmin, useSession } from "../auth/SessionContext";
import { ClientLoginPanel } from "./ClientLoginPanel";
import { PageHeader } from "../ui/PageHeader";
import { StatusTag } from "../ui/StatusTag";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";

export function ClientDetailsPage() {
  const session = useSession();
  const editable = canAdmin(session.role);
  const { clientId = "" } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The form mirrors the live record until the user starts editing; after that
  // their in-progress input wins so a background update cannot overwrite it.
  // This lives in a ref as well as state: the listener below is created once per
  // clientId, so reading `dirty` from state would read a stale closure forever.
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);

  function markDirty(next: boolean) {
    dirtyRef.current = next;
    setDirty(next);
  }

  useEffect(() => {
    setLoading(true); setLoadError(false); markDirty(false);
    return subscribeClient(db, clientId, (record) => {
      setClient(record);
      setLoading(false);
      if (record && !dirtyRef.current) {
        setName(record.name); setEmail(record.email);
        setPhone(record.phone ?? ""); setStatus(record.status);
      }
    }, () => { setLoadError(true); setLoading(false); });
  }, [clientId]);

  function edit<T>(setter: (value: T) => void) {
    return (value: T) => { markDirty(true); setNotice(null); setter(value); };
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSave = editable && dirty && name.trim().length > 0 && emailValid && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true); setError(null); setNotice(null);
    try {
      await updateClient(db, clientId, {
        name: name.trim(), email: email.trim(), phone: phone.trim(), status,
      });
      markDirty(false);
      setNotice("Client details saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client details could not be saved.");
    } finally { setSaving(false); }
  }

  function reset() {
    if (!client) return;
    setName(client.name); setEmail(client.email);
    setPhone(client.phone ?? ""); setStatus(client.status);
    markDirty(false); setError(null); setNotice(null);
  }

  return (
    <div className="content-stack">
      <Link to={`/clients/${clientId}`} className="back-link">
        <ArrowLeft size={14} style={{ display: "inline", verticalAlign: -2 }} /> {client?.name ?? "Client"} workspace
      </Link>
      <PageHeader
        eyebrow="Client record"
        title={client ? `${client.name} details` : "Client details"}
        description={editable ? "Contact details, relationship status, and portal access for this client." : "Contact details and relationship status for this client."}
        actions={editable ? <>
          <Button variant="outline" onPress={reset} isDisabled={!dirty || saving}>Discard changes</Button>
          <Button onPress={save} isDisabled={!canSave}><Save /> {saving ? "Saving…" : "Save details"}</Button>
        </> : undefined}
      />

      {loadError && <div className="data-error" role="alert"><CircleAlert /> Client details could not be loaded. Refresh to try again.</div>}
      {error && <div className="data-error" role="alert"><CircleAlert /> {error}</div>}
      {notice && <div className="data-success" role="status">{notice}</div>}

      <div className="overview-grid">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Contact details</CardTitle>
            {client && <StatusTag tone={client.status === "active" ? "done" : "neutral"}>{client.status}</StatusTag>}
          </CardHeader>
          <CardContent>
            {loading ? <div className="detail-form">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-9 w-full" />)}</div> : !client ? <p className="empty-state">This client no longer exists.</p> : (
              <form
                className="detail-form"
                onSubmit={(event) => { event.preventDefault(); void save(); }}
              >
                <div>
                  <Label htmlFor="client-name">Client name</Label>
                  <Input id="client-name" value={name} disabled={!editable} maxLength={160} onChange={(event) => edit(setName)(event.target.value)} />
                </div>
                <div>
                  <Label htmlFor="client-email">Primary email</Label>
                  <Input id="client-email" type="email" value={email} disabled={!editable} maxLength={254} aria-invalid={Boolean(email) && !emailValid} onChange={(event) => edit(setEmail)(event.target.value)} />
                  {Boolean(email) && !emailValid && <small className="form-error">Enter a valid email address.</small>}
                </div>
                <div>
                  <Label htmlFor="client-phone">Phone</Label>
                  <Input id="client-phone" type="tel" placeholder="Optional" value={phone} disabled={!editable} maxLength={40} onChange={(event) => edit(setPhone)(event.target.value)} />
                </div>
                <div>
                  <Label htmlFor="client-status">Relationship status</Label>
                  <NativeSelect id="client-status" value={status} disabled={!editable} onChange={(event) => edit(setStatus)(event.target.value as "active" | "archived")}>
                    <NativeSelectOption value="active">Active — accepting new work</NativeSelectOption>
                    <NativeSelectOption value="archived">Archived — no new projects</NativeSelectOption>
                  </NativeSelect>
                  <small className="form-message">Archiving keeps history intact and stops new projects being created.</small>
                </div>
                {editable && <button type="submit" hidden aria-hidden="true" tabIndex={-1} />}
              </form>
            )}
          </CardContent>
        </Card>

        <aside className="client-context">
          {editable && <ClientLoginPanel clientId={clientId} />}
          <Card>
            <CardHeader className="border-b"><CardTitle>Record</CardTitle></CardHeader>
            <CardContent className="access-card-body">
              <div><span>Client since</span><strong>{client ? new Date(client.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—"}</strong></div>
              <div><span>Portal login</span><strong>{client?.loginEmail ?? "Not set up yet"}</strong></div>
              <div><span>Reference</span><strong>{clientId}</strong></div>
              <Button variant="outline" size="sm" onPress={() => navigate(`/clients/${clientId}`)}><Building2 /> Open workspace</Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export default ClientDetailsPage;
