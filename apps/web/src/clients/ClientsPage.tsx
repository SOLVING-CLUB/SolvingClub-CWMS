import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createClient, subscribeClients, type Client } from "@solvingclub/core";
import { ArrowRight, Building2, CircleAlert, Mail, Plus, Search } from "lucide-react";
import { db } from "../db";
import { PageHeader } from "../ui/PageHeader";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { canAdmin, useSession } from "../auth/SessionContext";
import { filterClients } from "../lib/workspace";
import { Skeleton } from "@/components/ui/skeleton";

export function ClientsPage() {
  const session = useSession();
  const editable = canAdmin(session.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => subscribeClients(db, (nextClients) => {
    setClients(nextClients); setLoading(false); setLoadError(false);
  }, () => { setLoading(false); setLoadError(true); }), []);
  useEffect(() => {
    if (editable && searchParams.get("new") === "1") {
      setOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [editable, searchParams, setSearchParams]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    if (!name.trim() || !email.trim()) { setError("Enter a name and email address."); return; }
    setBusy(true);
    try {
      await createClient(db, { name: name.trim(), email: email.trim() });
      setName(""); setEmail(""); setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The client could not be created.");
    } finally { setBusy(false); }
  }

  const visible = filterClients(clients, query);

  return (
    <div className="content-stack">
      <PageHeader eyebrow="Relationships" title="Clients" description="Every active client and their delivery workspace."
        actions={editable ? <Button onPress={() => setOpen(true)}><Plus /> New client</Button> : undefined} />
      {loadError && <div className="data-error" role="alert"><CircleAlert /> Client updates could not be loaded. Refresh the page to retry.</div>}

      {clients.length > 0 && <section className="context-visual context-visual-clients"><img src="/visuals/client-network.jpg" alt="Abstract connected client network" /><div><span>Relationship system</span><strong>Every client stays connected to the work.</strong><p>Open a workspace to follow projects, applications, tasks, files, access, and billing in context.</p></div></section>}

      <div className="collection-toolbar"><div className="collection-search"><Search /><Input aria-label="Search clients" placeholder="Search clients..." value={query} onChange={(e) => setQuery(e.target.value)} /></div><span>{visible.length} of {clients.length}</span></div>

      {loading ? <div className="client-grid" role="status" aria-label="Loading clients">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-44 w-full" />)}</div> : visible.length === 0 ? (
        <EmptyState icon={<Building2 />} title={clients.length ? "No matching clients" : "Create your first client"}
          description={clients.length ? "Try a different name or email address." : "Client workspaces keep projects, tasks, files, and invoices together."}
          imageSrc={!clients.length ? "/visuals/client-network.jpg" : undefined} imageAlt="Abstract connected client network"
          action={!clients.length && editable ? <Button onPress={() => setOpen(true)}><Plus /> New client</Button> : undefined} />
      ) : (
        <div className="client-grid">
          {visible.map((client) => (
            <Link className={`client-card${client.status === "archived" ? " archived" : ""}`} key={client.id} to={`/clients/${client.id}`}>
              <div className="client-card-top"><span className="client-avatar large">{client.name.slice(0, 2).toUpperCase()}</span><span className={`status-pill status-${client.status}`}><i /> {client.status === "active" ? "Active" : "Archived"}</span></div>
              <div><h3>{client.name}</h3><p><Mail />{client.email}</p></div>
              <footer><span>Open workspace</span><ArrowRight /></footer>
            </Link>
          ))}
        </div>
      )}

      {editable && <Dialog isOpen={open} onOpenChange={setOpen}>
        <DialogHeader><DialogTitle>New client</DialogTitle><DialogDescription>Create a workspace for a new client relationship.</DialogDescription></DialogHeader>
        <form id="new-client" onSubmit={onAdd} className="dialog-form">
          <div><Label htmlFor="client-name">Client name</Label><Input id="client-name" autoFocus placeholder="Acme Studio" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label htmlFor="client-email">Primary email</Label><Input id="client-email" type="email" placeholder="hello@acme.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {error && <p className="form-error">{error}</p>}
        </form>
        <DialogFooter showCloseButton><Button type="submit" form="new-client" isDisabled={busy}>{busy ? "Creating…" : "Create client"}</Button></DialogFooter>
      </Dialog>}
    </div>
  );
}
