import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  subscribeProjectsByClient, updateProject, subscribeClient, subscribeApplicationsByClient, subscribeTasks,
  PROJECT_TYPE_LABELS, type Project, type Client, type Application, type Task,
} from "@solvingclub/core";
import { NewProjectDialog } from "../projects/NewProjectDialog";
import { db } from "../db";
import { Documents } from "../documents/Documents";
import { InvoicesPanel } from "../invoices/InvoicesPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowRight, FolderKanban, IdCard, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "../ui/PageHeader";
import { EmptyState } from "../ui/EmptyState";
import { ConfirmAction } from "../ui/ConfirmAction";
import { deleteProjectTree } from "../functions";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { canAdmin, useSession } from "../auth/SessionContext";
import { StatusTag } from "../ui/StatusTag";

export function ClientDetailPage() {
  const session = useSession();
  const editable = canAdmin(session.role);
  const { clientId = "" } = useParams();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [renaming, setRenaming] = useState<Project | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  useEffect(() => subscribeProjectsByClient(db, clientId, (items) => { setProjects(items); setWorkspaceError(null); }, () => setWorkspaceError("Projects could not be loaded. Refresh to try again.")), [clientId]);
  useEffect(() => subscribeApplicationsByClient(db, clientId, setApplications, () => setWorkspaceError("Project applications could not be loaded. Refresh to try again.")), [clientId]);
  useEffect(() => subscribeTasks(db, { clientId }, setTasks, () => setWorkspaceError("Project tasks could not be loaded. Refresh to try again.")), [clientId]);
  useEffect(() => subscribeClient(db, clientId, setClient, () => setWorkspaceError("Client details could not be loaded. Refresh to try again.")), [clientId]);

  function openRename(project: Project) {
    setRenaming(project); setRenameValue(project.name); setRenameError(null);
  }

  async function saveRename() {
    if (!renaming || !renameValue.trim()) return;
    setSavingRename(true); setRenameError(null);
    try {
      await updateProject(db, renaming.id, { name: renameValue.trim() });
      setRenaming(null);
    } catch (cause) {
      setRenameError(cause instanceof Error ? cause.message : "The project could not be renamed.");
    } finally { setSavingRename(false); }
  }

  return (
    <div className="content-stack">
      <Link to="/clients" className="back-link"><ArrowLeft size={14} style={{ display: "inline", verticalAlign: -2 }} /> Clients</Link>
      <PageHeader eyebrow="Client workspace" title={client?.name ?? "Client"} description={client?.email ?? "Loading client details…"}
        actions={<>
          <Button variant="outline" onPress={() => navigate(`/clients/${clientId}/details`)}><IdCard /> {editable ? "Client details" : "View details"}</Button>
          {editable && <Button onPress={() => document.getElementById("new-project")?.focus()}><Plus /> Add project</Button>}
        </>} />
      <nav className="section-tabs" aria-label="Client workspace sections"><Link to={`/clients/${clientId}/details`}>Details</Link><a href="#projects">Projects <span>{projects.length}</span></a><a href="#files">Files</a><a href="#billing">Billing</a></nav>
      {workspaceError && <p className="form-error" role="alert">{workspaceError}</p>}

      <div className="client-detail-grid">
      <section className="project-column" id="projects">
      <div className="section-heading"><div><h2>Projects</h2><p>Open a delivery stream to manage its applications, tasks, and files.</p></div></div>
      {editable && <Button id="new-project" onPress={() => setCreatingProject(true)}><Plus /> New project</Button>}
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
            <div className="client-project-copy"><div><StatusTag tone={project.status === "active" ? "done" : "neutral"}>{project.status}</StatusTag>{project.type && <span>{PROJECT_TYPE_LABELS[project.type]}</span>}<span>{projectApplications.length} application{projectApplications.length === 1 ? "" : "s"}</span></div><strong>{project.name}</strong><p>{project.description ?? "Applications, tasks, and project files in one workspace."}</p>{project.techStack?.length ? <p className="entity-meta">{project.techStack.join(" · ")}</p> : null}</div>
            <ArrowRight />
            <div className="client-project-progress"><span>{projectTasks.length ? `${complete} of ${projectTasks.length} tasks complete` : "No tasks yet"}{blocked ? ` · ${blocked} blocked` : ""}</span><i><b style={{ width: `${progress}%` }} /></i></div>
          </Link>
          {editable && <div className="client-project-actions"><Button variant="ghost" size="sm" onPress={() => openRename(project)}><Pencil /> Rename</Button><ConfirmAction title={`Delete ${project.name}?`} description="This permanently removes the project, its applications, tasks, comments, and document records." trigger={<Button aria-label={`Delete ${project.name}`} variant="ghost" size="icon-sm" className="text-destructive"><Trash2 /></Button>} onConfirm={async () => { await deleteProjectTree({ id: project.id }); }} /></div>}
        </article>;
      })}</div>
      </section>
      <aside className="client-context">
        <Card id="files"><CardHeader className="border-b"><CardTitle>Documents</CardTitle></CardHeader><CardContent><Documents ownerType="client" ownerId={clientId} clientId={clientId} canEdit={editable} /></CardContent></Card>
      </aside>
      </div>
      <section className="billing-section" id="billing"><div className="section-heading"><div><h2>Billing</h2><p>Invoices and payment status.</p></div></div><InvoicesPanel clientId={clientId} canEdit={editable} /></section>
      <NewProjectDialog isOpen={creatingProject} onOpenChange={setCreatingProject} clientId={clientId} />
      <Dialog isOpen={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogHeader><DialogTitle>Rename project</DialogTitle><DialogDescription>Use a short name your team and client will recognize.</DialogDescription></DialogHeader>
        <div className="dialog-form"><div><Label htmlFor="rename-project">Project name</Label><Input id="rename-project" autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} /></div>{renameError && <p className="form-error" role="alert">{renameError}</p>}</div>
        <DialogFooter showCloseButton><Button isDisabled={savingRename || !renameValue.trim()} onPress={saveRename}>{savingRename ? "Saving…" : "Save changes"}</Button></DialogFooter>
      </Dialog>
    </div>
  );
}
