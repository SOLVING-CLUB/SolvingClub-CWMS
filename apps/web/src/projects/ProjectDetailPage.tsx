import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PROJECT_TYPE_LABELS, subscribeClient, subscribeProject, subscribeTasks, updateProject, type Client, type Project, type ProjectType, type Task } from "@solvingclub/core";
import { ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, CircleAlert, FileText, FolderKanban, ListTodo, Pencil } from "lucide-react";
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
import { PriorityBadge } from "../ui/PrioritySelect";

const TASK_STATUS_TONE = { todo: "neutral", in_progress: "progress", blocked: "blocked", done: "done" } as const;
const PROJECT_TYPE_ORDER: ProjectType[] = [
  "web_app", "mobile_app", "desktop_app", "website",
  "api_service", "ai_ml", "data_platform", "automation", "other",
];

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
  const [type, setType] = useState<ProjectType | "">("");
  const [startDate, setStartDate] = useState("");
  const [stack, setStack] = useState("");
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
  const deliveryQueue = useMemo(() => {
    const statusRank = { blocked: 0, in_progress: 1, todo: 2, done: 3 } as const;
    return [...tasks].sort((left, right) => {
      const statusDifference = statusRank[left.status] - statusRank[right.status];
      if (statusDifference) return statusDifference;
      const priorityDifference = left.priority - right.priority;
      if (priorityDifference) return priorityDifference;
      return (left.dueDate ?? Number.MAX_SAFE_INTEGER) - (right.dueDate ?? Number.MAX_SAFE_INTEGER);
    }).slice(0, 5);
  }, [tasks]);

  function openEditor() {
    if (!project) return;
    setName(project.name); setDescription(project.description ?? ""); setStatus(project.status);
    setType(project.type ?? "");
    // <input type="date"> wants YYYY-MM-DD in UTC, matching how it was stored.
    setStartDate(project.startDate ? new Date(project.startDate).toISOString().slice(0, 10) : "");
    setStack((project.techStack ?? []).join(", "));
    setEditError(null); setEditing(true);
  }
  async function saveProject() {
    if (!project || !name.trim()) return;
    const parsedStart = startDate ? Date.parse(`${startDate}T00:00:00Z`) : NaN;
    const stackEntries = stack.split(",").map((entry) => entry.trim()).filter(Boolean).slice(0, 24);
    setSaving(true); setEditError(null);
    try {
      await updateProject(db, project.id, {
        name, description: description.trim() || null, status,
        type: type || null,
        startDate: Number.isNaN(parsedStart) ? null : parsedStart,
        techStack: stackEntries.length ? stackEntries : null,
      });
      setEditing(false);
    }
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
    <section className="project-profile" aria-label="Project profile">
      <div><span>Type</span><strong>{project.type ? PROJECT_TYPE_LABELS[project.type] : "Not specified"}</strong></div>
      <div><span>Start date</span><strong>{project.startDate ? new Date(project.startDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "Not set"}</strong></div>
      <div className="project-profile-stack"><span>Tech stack</span>{project.techStack?.length
        ? <div className="stack-tags">{project.techStack.map((entry) => <span className="stack-tag" key={entry}>{entry}</span>)}</div>
        : <strong>Not recorded</strong>}</div>
    </section>
    <section className="project-delivery-summary" aria-label="Project delivery pulse">
      <div><span>Open work</span><strong>{delivery.open}</strong><small><ListTodo /> Active tasks</small></div>
      <div><span>Completed</span><strong>{delivery.completed}</strong><small><CheckCircle2 /> Delivered tasks</small></div>
      <div className={delivery.blocked ? "risk" : ""}><span>Blocked</span><strong>{delivery.blocked}</strong><small><CircleAlert /> Needs attention</small></div>
      <div className={delivery.overdue ? "risk" : ""}><span>Overdue</span><strong>{delivery.overdue}</strong><small><CalendarClock /> Past deadline</small></div>
    </section>
    <section className="project-delivery-queue" aria-labelledby="project-delivery-queue-title">
      <header><div><span>Delivery queue</span><h2 id="project-delivery-queue-title">Work that needs attention</h2></div><Link to="/work">Open all work <ArrowRight /></Link></header>
      {deliveryQueue.length ? <div className="project-delivery-rows">
        {deliveryQueue.map((task) => <Link key={task.id} to={`/applications/${task.clientId}/${task.applicationId}`} className={`project-delivery-row${task.status === "blocked" ? " blocked" : ""}`}>
          <div><strong>{task.title}</strong><span>{task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "No deadline"}</span></div>
          <PriorityBadge value={task.priority} compact />
          <StatusTag tone={TASK_STATUS_TONE[task.status]}>{task.status.replace("_", " ")}</StatusTag>
          <ArrowRight aria-hidden="true" />
        </Link>)}
      </div> : <p className="project-delivery-empty">No delivery tasks yet. Tasks will appear here as applications begin work.</p>}
    </section>
    <div className="client-detail-grid">
      <section className="project-column"><div className="section-heading"><div><h2>Applications</h2><p>Delivery workstreams in this project.</p></div></div><ProjectApplications projectId={project.id} clientId={project.clientId} canEdit={editable && project.status === "active"} /></section>
      <aside className="client-context"><Card><CardHeader className="border-b"><CardTitle><FileText /> Project files</CardTitle></CardHeader><CardContent><Documents ownerType="project" ownerId={project.id} clientId={project.clientId} canEdit={editable} /></CardContent></Card></aside>
    </div>
    <Dialog isOpen={editing} onOpenChange={setEditing}>
      <DialogHeader><DialogTitle>Edit project</DialogTitle><DialogDescription>Keep project context clear for delivery planning and client collaboration.</DialogDescription></DialogHeader>
      <div className="dialog-form project-edit-form">
        <div><Label htmlFor="project-name">Name</Label><Input id="project-name" autoFocus value={name} maxLength={160} onChange={(event) => setName(event.target.value)} /></div>
        <div><Label htmlFor="project-status">Status</Label><NativeSelect id="project-status" value={status} onChange={(event) => setStatus(event.target.value as "active" | "archived")}><NativeSelectOption value="active">Active</NativeSelectOption><NativeSelectOption value="archived">Archived</NativeSelectOption></NativeSelect></div>
        <div><Label htmlFor="project-type">Project type</Label><NativeSelect id="project-type" value={type} onChange={(event) => setType(event.target.value as ProjectType | "")}><NativeSelectOption value="">Not specified</NativeSelectOption>{PROJECT_TYPE_ORDER.map((option) => <NativeSelectOption key={option} value={option}>{PROJECT_TYPE_LABELS[option]}</NativeSelectOption>)}</NativeSelect></div>
        <div><Label htmlFor="project-start">Start date <span>Optional</span></Label><Input id="project-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div>
        <div><Label htmlFor="project-stack">Tech stack <span>Comma separated</span></Label><Input id="project-stack" placeholder="React, Node, Postgres" value={stack} onChange={(event) => setStack(event.target.value)} /></div>
        <div><Label htmlFor="project-description">Description <span>Optional</span></Label><Textarea id="project-description" placeholder="Scope, delivery goals, or context…" value={description} maxLength={4000} onChange={(event) => setDescription(event.target.value)} /></div>
        {editError && <p className="form-error" role="alert">{editError}</p>}
      </div>
      <DialogFooter showCloseButton><Button isDisabled={saving || !name.trim()} onPress={saveProject}>{saving ? "Saving…" : "Save changes"}</Button></DialogFooter>
    </Dialog>
  </div>;
}
