import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  subscribeProjectsByClient, createProject, updateProject, subscribeClient, updateClient, subscribeApplicationsByClient, subscribeTasks,
  type Project, type Client, type Application, type Task,
} from "@solvingclub/core";
import { db } from "../db";
import { ClientLoginPanel } from "./ClientLoginPanel";
import { Documents } from "../documents/Documents";
import { InvoicesPanel } from "../invoices/InvoicesPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowRight, FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "../ui/PageHeader";
import { EmptyState } from "../ui/EmptyState";
import { ConfirmAction } from "../ui/ConfirmAction";
import { deleteProjectTree } from "../functions";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { canAdmin, useSession } from "../auth/SessionContext";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { StatusTag } from "../ui/StatusTag";

export function ClientDetailPage() {
  const session = useSession();
  const editable = canAdmin(session.role);
  const { clientId = "" } = useParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<Project | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editingClient, setEditingClient] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientStatus, setClientStatus] = useState<"active" | "archived">("active");
  const [savingClient, setSavingClient] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  useEffect(() => subscribeProjectsByClient(db, clientId, (items) => { setProjects(items); setWorkspaceError(null); }, () => setWorkspaceError("Projects could not be loaded. Refresh to try again.")), [clientId]);
  useEffect(() => subscribeApplicationsByClient(db, clientId, setApplications, () => setWorkspaceError("Project applications could not be loaded. Refresh to try again.")), [clientId]);
  useEffect(() => subscribeTasks(db, { clientId }, setTasks, () => setWorkspaceError("Project tasks could not be loaded. Refresh to try again.")), [clientId]);
  useEffect(() => subscribeClient(db, clientId, setClient, () => setWorkspaceError("Client details could not be loaded. Refresh to try again.")), [clientId]);

  function openClientEditor() {
    if (!client) return;
    setClientName(client.name); setClientEmail(client.email); setClientPhone(client.phone ?? "");
    setClientStatus(client.status); setClientError(null); setEditingClient(true);
  }

  async function saveClient() {
    if (!clientName.trim() || !clientEmail.trim()) return;
    setSavingClient(true); setClientError(null);
    try {
      await updateClient(db, clientId, {
        name: clientName, email: clientEmail.trim(), phone: clientPhone, status: clientStatus,
      });
      setEditingClient(false);
    } catch (cause) {
      setClientError(cause instanceof Error ? cause.message : "Client details could not be saved.");
    } finally { setSavingClient(false); }
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createProject(db, { clientId, name: name.trim() });
    setName("");
  }

  return (
    <div className="content-stack">
      <Link to="/clients" className="back-link"><ArrowLeft size={14} style={{ display: "inline", verticalAlign: -2 }} /> Clients</Link>
      <PageHeader eyebrow="Client workspace" title={client?.name ?? "Client"} description={client?.email ?? "Loading client details…"}
        actions={editable ? <><Button variant="outline" onPress={openClientEditor}><Pencil /> Edit client</Button><Button onPress={() => document.getElementById("new-project")?.focus()}><Plus /> Add project</Button></> : undefined} />
      <nav className="section-tabs" aria-label="Client workspace sections"><a href="#projects">Projects <span>{projects.length}</span></a><a href="#files">Files</a><a href="#billing">Billing</a></nav>
      {workspaceError && <p className="form-error" role="alert">{workspaceError}</p>}

      <div className="client-detail-grid">
      <section className="project-column" id="projects">
      <div className="section-heading"><div><h2>Projects</h2><p>Open a delivery stream to manage its applications, tasks, and files.</p></div></div>
      {editable && <form onSubmit={onAdd} className="quick-create"><Plus /><Input id="new-project" aria-label="Project name" placeholder="Create a project..." value={name} onChange={(e) => setName(e.target.value)} /><Button type="submit" size="sm">Create</Button></form>}
      {projects.length === 0 && <EmptyState icon={<FolderKanban />} title="No projects yet" description="Create the first delivery stream for this client." imageSrc="/visuals/delivery-routing.jpg" imageAlt="Abstract delivery routing system" />}
      <div className="client-project-grid">{projects.map((project) => {
        const projectApplications = applications.filter((application) => application.projectId === project.id);
        const projectTasks = tasks.filter((task) => task.projectId === project.id);
        const complete = projectTasks.filter((task) => task.status === "done").length;
        const blocked = projectTasks.filter((task) => task.status === "blocked").length;
        const progress = projectTasks.length ? Math.round((complete / projectTasks.length) * 100) : 0;
        return <article className="client-project-card" key={project.id}>
          <Link className="client-project-open" to={`/projects/${project.id}`}>
            <span className="client-project-icon"><FolderKanban /></span>
            <div className="client-project-copy"><div><StatusTag tone={project.status === "active" ? "done" : "neutral"}>{project.status}</StatusTag><span>{projectApplications.length} application{projectApplications.length === 1 ? "" : "s"}</span></div><strong>{project.name}</strong><p>{project.description ?? "Applications, tasks, and project files in one workspace."}</p></div>
            <ArrowRight />
            <div className="client-project-progress"><span>{projectTasks.length ? `${complete} of ${projectTasks.length} tasks complete` : "No tasks yet"}{blocked ? ` · ${blocked} blocked` : ""}</span><i><b style={{ width: `${progress}%` }} /></i></div>
          </Link>
          {editable && <div className="client-project-actions"><Button variant="ghost" size="sm" onPress={() => { setRenaming(project); setRenameValue(project.name); }}><Pencil /> Rename</Button><ConfirmAction title={`Delete ${project.name}?`} description="This permanently removes the project, its applications, tasks, comments, and document records." trigger={<Button aria-label={`Delete ${project.name}`} variant="ghost" size="icon-sm" className="text-destructive"><Trash2 /></Button>} onConfirm={async () => { await deleteProjectTree({ id: project.id }); }} /></div>}
        </article>;
      })}</div>
      </section>
      <aside className="client-context">
        {editable && <ClientLoginPanel clientId={clientId} />}
        <Card id="files"><CardHeader className="border-b"><CardTitle>Documents</CardTitle></CardHeader><CardContent><Documents ownerType="client" ownerId={clientId} clientId={clientId} canEdit={editable} /></CardContent></Card>
      </aside>
      </div>
      <section className="billing-section" id="billing"><div className="section-heading"><div><h2>Billing</h2><p>Invoices and payment status.</p></div></div><InvoicesPanel clientId={clientId} canEdit={editable} /></section>
      <Dialog isOpen={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogHeader><DialogTitle>Rename project</DialogTitle><DialogDescription>Use a short name your team and client will recognize.</DialogDescription></DialogHeader>
        <div className="dialog-form"><div><Label htmlFor="rename-project">Project name</Label><Input id="rename-project" autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} /></div></div>
        <DialogFooter showCloseButton><Button isDisabled={!renameValue.trim()} onPress={async () => { if (!renaming) return; await updateProject(db, renaming.id, { name: renameValue.trim() }); setRenaming(null); }}>Save changes</Button></DialogFooter>
      </Dialog>
      <Dialog isOpen={editingClient} onOpenChange={setEditingClient}>
        <DialogHeader><DialogTitle>Edit client</DialogTitle><DialogDescription>Update the relationship details shown across the workspace.</DialogDescription></DialogHeader>
        <div className="dialog-form">
          <div><Label htmlFor="edit-client-name">Client name</Label><Input id="edit-client-name" autoFocus value={clientName} onChange={(e) => setClientName(e.target.value)} /></div>
          <div><Label htmlFor="edit-client-email">Primary email</Label><Input id="edit-client-email" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} /></div>
          <div><Label htmlFor="edit-client-phone">Phone</Label><Input id="edit-client-phone" type="tel" placeholder="Optional" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} /></div>
          <div><Label htmlFor="edit-client-status">Status</Label><NativeSelect id="edit-client-status" value={clientStatus} onChange={(e) => setClientStatus(e.target.value as "active" | "archived")}><NativeSelectOption value="active">Active</NativeSelectOption><NativeSelectOption value="archived">Archived</NativeSelectOption></NativeSelect></div>
          {clientError && <p className="form-error" role="alert">{clientError}</p>}
        </div>
        <DialogFooter showCloseButton><Button isDisabled={savingClient || !clientName.trim() || !clientEmail.includes("@")} onPress={saveClient}>{savingClient ? "Saving…" : "Save changes"}</Button></DialogFooter>
      </Dialog>
    </div>
  );
}
