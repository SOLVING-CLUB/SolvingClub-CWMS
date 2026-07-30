import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import {
  subscribeTasks, createTask, updateTask, subscribeMembers, subscribeApplication, subscribeClient, subscribeProject, updateApplication,
  type Task, type Member, type TaskStatus, type Application, type Client, type Project,
} from "@solvingclub/core";
import { db } from "../db";
import { fb } from "../firebase";
import { TaskForm } from "./TaskForm";
import { Comments } from "./Comments";
import { Documents } from "../documents/Documents";
import { StatusSelect, StatusTag, type StatusTone } from "../ui/StatusTag";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { CalendarClock, CheckSquare2, CircleAlert, Columns3, Filter, GripVertical, List, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "../ui/PageHeader";
import { EmptyState } from "../ui/EmptyState";
import { canAdmin, useSession } from "../auth/SessionContext";
import { ConfirmAction } from "../ui/ConfirmAction";
import { deleteTaskTree } from "../functions";
import { canEditTask, resolveTaskAssignee } from "../lib/workspace";
import { PriorityBadge, PrioritySelect } from "../ui/PrioritySelect";
import { TaskEditDialog } from "./TaskEditDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];
const STATUS_TONE: Record<TaskStatus, StatusTone> = { todo: "neutral", in_progress: "progress", blocked: "blocked", done: "done" };

function dueLabel(dueDate?: number) {
  if (!dueDate) return "No deadline";
  const due = new Date(dueDate); const today = new Date();
  today.setHours(0, 0, 0, 0); due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TasksPage() {
  const session = useSession();
  const admin = canAdmin(session.role);
  const location = useLocation();
  const { applicationId = "", clientId = "" } = useParams();
  const [application, setApplication] = useState<Application | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [view, setView] = useState<"list" | "board">("list");
  const [editingApplication, setEditingApplication] = useState(false);
  const [applicationName, setApplicationName] = useState("");
  const [applicationType, setApplicationType] = useState("");
  const [applicationDescription, setApplicationDescription] = useState("");
  const [applicationStatus, setApplicationStatus] = useState<"active" | "archived">("active");
  const [savingApplication, setSavingApplication] = useState(false);
  const [applicationError, setApplicationError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [dropStatus, setDropStatus] = useState<TaskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => subscribeMembers(db, setMembers, () => setLoadError(true)), []);
  useEffect(() => subscribeApplication(db, applicationId, setApplication, () => setLoadError(true)), [applicationId]);
  useEffect(() => subscribeClient(db, clientId, setClient, () => setLoadError(true)), [clientId]);
  useEffect(() => {
    if (!application?.projectId) { setProject(null); return; }
    return subscribeProject(db, application.projectId, setProject, () => setLoadError(true));
  }, [application?.projectId]);
  useEffect(() => {
    setLoading(true); setLoadError(false);
    return subscribeTasks(db, {
      applicationId,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(assigneeFilter ? { assigneeUid: assigneeFilter } : {}),
    }, (nextTasks) => { setTasks(nextTasks); setLoading(false); setLoadError(false); }, () => { setLoading(false); setLoadError(true); });
  }, [applicationId, statusFilter, assigneeFilter]);

  const memberNames = new Map(members.map((member) => [member.uid, member.name]));
  function openApplicationEditor() {
    if (!application) return;
    setApplicationName(application.name); setApplicationType(application.type ?? "");
    setApplicationDescription(application.description ?? ""); setApplicationStatus(application.status);
    setApplicationError(null); setEditingApplication(true);
  }
  async function saveApplication() {
    if (!application || !applicationName.trim()) return;
    setSavingApplication(true); setApplicationError(null);
    try {
      await updateApplication(db, application.id, {
        name: applicationName, type: applicationType.trim() || null,
        description: applicationDescription.trim() || null, status: applicationStatus,
      });
      setEditingApplication(false);
    } catch (cause) { setApplicationError(cause instanceof Error ? cause.message : "Application details could not be saved."); }
    finally { setSavingApplication(false); }
  }
  function submitApplicationEditor(event: React.FormEvent) { event.preventDefault(); void saveApplication(); }
  async function updateTaskSafely(id: string, patch: Parameters<typeof updateTask>[2]) {
    try { await updateTask(db, id, patch); setActionError(null); }
    catch { setActionError("This task change could not be saved. Please try again."); }
  }
  async function moveTaskToStatus(status: TaskStatus) {
    const task = draggingTask;
    setDraggingTask(null); setDropStatus(null);
    if (!task || task.status === status) return;
    await updateTaskSafely(task.id, { status });
  }

  return <div className="content-stack application-tasks-page">
    <Link to={location.pathname.startsWith("/applications/") ? "/applications" : `/clients/${clientId}`} className="back-link">← {location.pathname.startsWith("/applications/") ? "Applications" : "Client workspace"}</Link>
    {location.pathname.startsWith("/applications/") && <nav className="workspace-breadcrumb" aria-label="Application location">
      <Link to={`/clients/${clientId}`}>{client?.name ?? "Client"}</Link><span aria-hidden="true">/</span>
      {project ? <Link to={`/projects/${project.id}`}>{project.name}</Link> : <span>Project</span>}<span aria-hidden="true">/</span>
      <strong>{application?.name ?? "Application"}</strong>
    </nav>}
    <PageHeader eyebrow={project?.name ?? application?.type ?? "Application"} title={application?.name ?? "Delivery tasks"} description={application?.description ?? "Plan, assign, and discuss delivery work."}
      actions={application ? <><StatusTag tone={application.status === "active" ? "done" : "neutral"}>{application.status}</StatusTag>{admin && <Button variant="outline" size="sm" onPress={openApplicationEditor}><Pencil /> Edit application</Button>}</> : undefined} />
    {loadError && <div className="data-error" role="alert"><CircleAlert /> Delivery work could not be synchronized. Refresh the page to retry.</div>}
    {actionError && <div className="data-error" role="alert"><CircleAlert /> {actionError}</div>}

    {application && application.status === "active" && project?.status === "active" && <TaskForm members={members} fixedAssigneeUid={admin ? undefined : session.uid} onSubmit={async (values) => {
      const assigneeUid = resolveTaskAssignee(admin, session.uid, values.assigneeUid);
      await createTask(db, {
        applicationId, projectId: application.projectId, clientId, createdBy: fb.auth.currentUser?.uid ?? "unknown",
        title: values.title, priority: values.priority,
        ...(assigneeUid ? { assigneeUid } : {}), ...(values.dueDate ? { dueDate: values.dueDate } : {}),
      });
    }} />}
    {application && (application.status === "archived" || project?.status === "archived") && <div className="archive-notice" role="status"><CircleAlert /> This delivery workspace is archived. Existing tasks remain available, but new tasks are paused until it is reactivated.</div>}

    <div className="filter-bar task-filter-bar"><Filter />
      <NativeSelect aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TaskStatus | "")}><NativeSelectOption value="">All statuses</NativeSelectOption>{STATUSES.map((status) => <NativeSelectOption key={status} value={status}>{status.replace("_", " ")}</NativeSelectOption>)}</NativeSelect>
      <NativeSelect aria-label="Filter by assignee" value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}><NativeSelectOption value="">All assignees</NativeSelectOption>{members.map((member) => <NativeSelectOption key={member.uid} value={member.uid}>{member.name}</NativeSelectOption>)}</NativeSelect>
      <div className="task-view-switcher" aria-label="Task view">
        <Button aria-pressed={view === "list"} variant={view === "list" ? "secondary" : "ghost"} size="sm" onPress={() => setView("list")}><List /> List</Button>
        <Button aria-pressed={view === "board"} variant={view === "board" ? "secondary" : "ghost"} size="sm" onPress={() => setView("board")}><Columns3 /> Board</Button>
      </div>
      <span>{tasks.length} task{tasks.length === 1 ? "" : "s"}</span>
    </div>

    {loading ? <div className="application-task-loading" role="status" aria-label="Loading tasks">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-16 w-full" />)}</div> : tasks.length === 0 ? (
      <EmptyState icon={<CheckSquare2 />} title="No matching tasks" description="Create a task or change the active filters." imageSrc="/visuals/delivery-routing.jpg" imageAlt="Abstract delivery routing system" />
    ) : view === "list" ? <section className="application-task-list" aria-label="Application tasks">
      <header className="application-task-head"><span>Task</span><span>Status</span><span>Priority</span><span>Assignee</span><span>Deadline</span><span className="sr-only">Actions</span></header>
      {tasks.map((task) => {
        const editable = canEditTask(admin, session.uid, task.assigneeUid);
        const overdue = Boolean(task.dueDate && task.dueDate < Date.now() && task.status !== "done");
        return <article key={task.id} className={`application-task${openComments === task.id ? " expanded" : ""}${overdue ? " overdue" : ""}`}>
          <div className="application-task-row">
            <button className="application-task-title" type="button" disabled={!editable} onClick={() => setEditingTask(task)}><strong>{task.title}</strong><small>{task.description || "No additional description"}</small></button>
            <StatusSelect isDisabled={!editable} value={task.status} tone={STATUS_TONE[task.status]} options={STATUSES} onChange={(status) => updateTaskSafely(task.id, { status })} />
            <PrioritySelect isDisabled={!editable} value={task.priority} label={`Priority for ${task.title}`} onChange={(priority) => updateTaskSafely(task.id, { priority })} />
            <NativeSelect disabled={!admin} aria-label={`Assignee for ${task.title}`} value={task.assigneeUid ?? ""} onChange={(event) => updateTaskSafely(task.id, { assigneeUid: event.target.value || null })}><NativeSelectOption value="">Unassigned</NativeSelectOption>{members.map((member) => <NativeSelectOption key={member.uid} value={member.uid}>{member.name}</NativeSelectOption>)}</NativeSelect>
            <time className={overdue ? "overdue" : ""} dateTime={task.dueDate ? new Date(task.dueDate).toISOString() : undefined}><CalendarClock /><span>{dueLabel(task.dueDate)}</span></time>
            <div className="application-task-actions"><Button variant="ghost" size="icon-sm" aria-label={`${openComments === task.id ? "Hide" : "Open"} discussion for ${task.title}`} onPress={() => setOpenComments(openComments === task.id ? null : task.id)}><MessageSquare /></Button>{editable && <Button variant="ghost" size="icon-sm" aria-label={`Edit ${task.title}`} onPress={() => setEditingTask(task)}><Pencil /></Button>}{admin && <ConfirmAction title={`Delete ${task.title}?`} description="This permanently removes the task, its discussion, and document records." trigger={<Button aria-label={`Delete ${task.title}`} variant="ghost" size="icon-sm" className="text-destructive"><Trash2 /></Button>} onConfirm={async () => { await deleteTaskTree({ id: task.id }); }} />}</div>
          </div>
          {openComments === task.id && <div className="application-task-detail"><Comments taskId={task.id} clientId={task.clientId} authorType="member" /><Documents ownerType="task" ownerId={task.id} clientId={task.clientId} canEdit={admin} /></div>}
        </article>;
      })}
    </section> : <section className="application-task-board" aria-label="Application task board">
      {STATUSES.map((status) => {
        const statusTasks = tasks.filter((task) => task.status === status);
        return <section className={`application-board-column${dropStatus === status ? " is-drop-target" : ""}`} key={status} aria-label={`${status.replace("_", " ")} tasks`} onDragOver={(event) => { event.preventDefault(); if (draggingTask) setDropStatus(status); }} onDrop={(event) => { event.preventDefault(); void moveTaskToStatus(status); }}>
          <header><StatusTag tone={STATUS_TONE[status]}>{status.replace("_", " ")}</StatusTag><span>{statusTasks.length}</span></header>
          <div className="application-board-cards">
            {statusTasks.length === 0 ? <p className="application-board-empty">No tasks</p> : statusTasks.map((task) => {
              const editable = canEditTask(admin, session.uid, task.assigneeUid);
              const overdue = Boolean(task.dueDate && task.dueDate < Date.now() && task.status !== "done");
              return <article className={`application-board-card${overdue ? " overdue" : ""}${draggingTask?.id === task.id ? " is-dragging" : ""}`} key={task.id} draggable={editable} onDragStart={(event) => { if (!editable) return; event.dataTransfer.effectAllowed = "move"; setDraggingTask(task); }} onDragEnd={() => { setDraggingTask(null); setDropStatus(null); }}>
                {editable && <span className="application-board-grip" aria-hidden="true"><GripVertical /></span>}
                <button className="application-board-title" type="button" disabled={!editable} onClick={() => setEditingTask(task)}>
                  <strong>{task.title}</strong><small>{task.description || "No additional description"}</small>
                </button>
                <div className="application-board-meta"><PriorityBadge value={task.priority} /><time className={overdue ? "overdue" : ""} dateTime={task.dueDate ? new Date(task.dueDate).toISOString() : undefined}><CalendarClock />{dueLabel(task.dueDate)}</time></div>
                <div className="application-board-footer"><span>{task.assigneeUid ? memberNames.get(task.assigneeUid) ?? "Assigned" : "Unassigned"}</span><StatusSelect isDisabled={!editable} value={task.status} tone={STATUS_TONE[task.status]} options={STATUSES} onChange={(nextStatus) => updateTaskSafely(task.id, { status: nextStatus })} /></div>
                <div className="application-board-actions"><Button variant="ghost" size="icon-sm" aria-label={`${openComments === task.id ? "Hide" : "Open"} discussion for ${task.title}`} onPress={() => setOpenComments(openComments === task.id ? null : task.id)}><MessageSquare /></Button>{editable && <Button variant="ghost" size="icon-sm" aria-label={`Edit ${task.title}`} onPress={() => setEditingTask(task)}><Pencil /></Button>}</div>
                {openComments === task.id && <div className="application-board-detail"><Comments taskId={task.id} clientId={task.clientId} authorType="member" /><Documents ownerType="task" ownerId={task.id} clientId={task.clientId} canEdit={admin} /></div>}
              </article>;
            })}
          </div>
        </section>;
      })}
    </section>}
    <TaskEditDialog task={editingTask} members={members} canAssign={admin} onOpenChange={(open) => !open && setEditingTask(null)} onSaved={async () => {}} />
    <Dialog isOpen={editingApplication} onOpenChange={setEditingApplication}>
      <DialogHeader><DialogTitle>Edit application</DialogTitle><DialogDescription>Keep delivery context, scope, and lifecycle accurate for everyone working in this workspace.</DialogDescription></DialogHeader>
      <form id="application-workspace-editor" className="dialog-form application-edit-form" onSubmit={submitApplicationEditor}>
        <div><Label htmlFor="workspace-application-name">Name</Label><Input id="workspace-application-name" autoFocus value={applicationName} maxLength={160} onChange={(event) => setApplicationName(event.target.value)} /></div>
        <div><Label htmlFor="workspace-application-type">Type <span>Optional</span></Label><Input id="workspace-application-type" placeholder="Website, API, campaign…" value={applicationType} maxLength={80} onChange={(event) => setApplicationType(event.target.value)} /></div>
        <div><Label htmlFor="workspace-application-status">Status</Label><NativeSelect id="workspace-application-status" value={applicationStatus} onChange={(event) => setApplicationStatus(event.target.value as "active" | "archived")}><NativeSelectOption value="active">Active</NativeSelectOption><NativeSelectOption value="archived">Archived</NativeSelectOption></NativeSelect></div>
        <div><Label htmlFor="workspace-application-description">Description <span>Optional</span></Label><Textarea id="workspace-application-description" placeholder="Brief scope, goals, or delivery notes…" value={applicationDescription} maxLength={4000} onChange={(event) => setApplicationDescription(event.target.value)} /></div>
        {applicationError && <p className="form-error" role="alert">{applicationError}</p>}
      </form>
      <DialogFooter showCloseButton><Button type="submit" form="application-workspace-editor" isDisabled={savingApplication || !applicationName.trim()}>{savingApplication ? "Saving…" : "Save changes"}</Button></DialogFooter>
    </Dialog>
  </div>;
}
