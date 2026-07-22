import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { subscribeClient, subscribeProject, subscribeTasks, updateProject, type Client, type Project, type Task } from "@solvingclub/core";
import { ArrowLeft, CalendarClock, CheckCircle2, CircleAlert, FileText, FolderKanban, ListTodo, Pencil } from "lucide-react";
import { db } from "../db";
import { PageHeader } from "../ui/PageHeader";
import { ProjectApplications } from "./ProjectApplications";
import { Documents } from "../documents/Documents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusTag } from "../ui/StatusTag";
import { canAdmin, useSession } from "../auth/SessionContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export function ProjectDetailPage() {
  const session = useSession();
  const editable = canAdmin(session.role);
  const { projectId = "" } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => subscribeProject(db, projectId, (item) => { setProject(item); setError(false); }, () => setError(true)), [projectId]);
  useEffect(() => {
    if (!project?.clientId) return;
    return subscribeClient(db, project.clientId, setClient, () => setError(true));
  }, [project?.clientId]);
  useEffect(() => {
    if (!project?.clientId) return;
    return subscribeTasks(db, { projectId, clientId: project.clientId }, setTasks, () => setError(true));
  }, [projectId, project?.clientId]);

  const delivery = useMemo(() => {
    const now = Date.now();
    const open = tasks.filter((task) => task.status !== "done").length;
    const completed = tasks.filter((task) => task.status === "done").length;
    const blocked = tasks.filter((task) => task.status === "blocked").length;
    const overdue = tasks.filter((task) => task.status !== "done" && task.dueDate && task.dueDate < now).length;
    return { open, completed, blocked, overdue };
  }, [tasks]);

  function openEditor() {
    if (!project) return;
    setName(project.name); setDescription(project.description ?? ""); setStatus(project.status); setEditError(null); setEditing(true);
  }
  async function saveProject() {
    if (!project || !name.trim()) return;
    setSaving(true); setEditError(null);
    try { await updateProject(db, project.id, { name, description: description.trim() || null, status }); setEditing(false); }
    catch (cause) { setEditError(cause instanceof Error ? cause.message : "Project details could not be saved."); }
    finally { setSaving(false); }
  }

  if (!project && !error) return <div className="content-stack"><div className="project-workspace-loading"><FolderKanban /><span>Loading project workspace…</span></div></div>;
  if (!project) return <div className="content-stack"><Link to="/projects" className="back-link"><ArrowLeft /> Projects</Link><div className="data-error" role="alert"><CircleAlert /> This project could not be found or loaded.</div></div>;

  return <div className="content-stack project-detail-page">
    <Link to="/projects" className="back-link"><ArrowLeft /> Projects</Link>
    <PageHeader eyebrow={client?.name ?? "Client project"} title={project.name} description={project.description ?? "Applications, delivery tasks, and project files in one focused workspace."}
      actions={<><StatusTag tone={project.status === "active" ? "done" : "neutral"}>{project.status}</StatusTag>{editable && <Button variant="outline" size="sm" onPress={openEditor}><Pencil /> Edit project</Button>}</>} />
    {error && <div className="data-error" role="alert"><CircleAlert /> Some project updates could not be loaded. Refresh to retry.</div>}
    <section className="project-delivery-summary" aria-label="Project delivery pulse">
      <div><span>Open work</span><strong>{delivery.open}</strong><small><ListTodo /> Active tasks</small></div>
      <div><span>Completed</span><strong>{delivery.completed}</strong><small><CheckCircle2 /> Delivered tasks</small></div>
      <div className={delivery.blocked ? "risk" : ""}><span>Blocked</span><strong>{delivery.blocked}</strong><small><CircleAlert /> Needs attention</small></div>
      <div className={delivery.overdue ? "risk" : ""}><span>Overdue</span><strong>{delivery.overdue}</strong><small><CalendarClock /> Past deadline</small></div>
    </section>
    <div className="client-detail-grid">
      <section className="project-column"><div className="section-heading"><div><h2>Applications</h2><p>Delivery workstreams in this project.</p></div></div><ProjectApplications projectId={project.id} clientId={project.clientId} canEdit={editable} /></section>
      <aside className="client-context"><Card><CardHeader className="border-b"><CardTitle><FileText /> Project files</CardTitle></CardHeader><CardContent><Documents ownerType="project" ownerId={project.id} clientId={project.clientId} canEdit={editable} /></CardContent></Card></aside>
    </div>
    <Dialog isOpen={editing} onOpenChange={setEditing}>
      <DialogHeader><DialogTitle>Edit project</DialogTitle><DialogDescription>Keep project context clear for delivery planning and client collaboration.</DialogDescription></DialogHeader>
      <div className="dialog-form project-edit-form">
        <div><Label htmlFor="project-name">Name</Label><Input id="project-name" autoFocus value={name} maxLength={160} onChange={(event) => setName(event.target.value)} /></div>
        <div><Label htmlFor="project-status">Status</Label><NativeSelect id="project-status" value={status} onChange={(event) => setStatus(event.target.value as "active" | "archived")}><NativeSelectOption value="active">Active</NativeSelectOption><NativeSelectOption value="archived">Archived</NativeSelectOption></NativeSelect></div>
        <div><Label htmlFor="project-description">Description <span>Optional</span></Label><Textarea id="project-description" placeholder="Scope, delivery goals, or context…" value={description} maxLength={4000} onChange={(event) => setDescription(event.target.value)} /></div>
        {editError && <p className="form-error" role="alert">{editError}</p>}
      </div>
      <DialogFooter showCloseButton><Button isDisabled={saving || !name.trim()} onPress={saveProject}>{saving ? "Saving…" : "Save changes"}</Button></DialogFooter>
    </Dialog>
  </div>;
}
