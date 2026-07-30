import { useEffect, useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import {
  subscribeProjectsByClient, subscribeApplicationsByClient, subscribeTasks, updateTask, subscribeClientNotifications,
  subscribeClient, type Project, type Application, type Task, type TaskStatus, type Client,
} from "@solvingclub/core";
import { db } from "../db";
import { fb } from "../firebase";
import { Comments } from "../tasks/Comments";
import { Documents } from "../documents/Documents";
import { ClientSharedDocuments } from "../documents/ClientSharedDocuments";
import { NotificationBell } from "../notifications/NotificationBell";
import { InvoicesPanel } from "../invoices/InvoicesPanel";
import { StatusTag, type StatusTone } from "../ui/StatusTag";
import { Button } from "@/components/ui/button";
import { CheckCircle2, LogOut, MessageSquare } from "lucide-react";
import { ThemeToggle } from "../ui/ThemeToggle";
import { BrandLogo } from "../ui/BrandLogo";
import { PageHeader } from "../ui/PageHeader";
import { FileText, FolderKanban, LayoutDashboard, ReceiptText } from "lucide-react";
import { PrioritySelect } from "../ui/PrioritySelect";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_TONE: Record<TaskStatus, StatusTone> = {
  todo: "neutral", in_progress: "progress", blocked: "blocked", done: "done",
};
const PORTAL_SECTION_LABEL: Record<"overview" | "delivery" | "documents" | "invoices", string> = {
  overview: "Overview", delivery: "Delivery", documents: "Documents", invoices: "Invoices",
};

function AppTasks({ application, tasks }: { application: Application; tasks: Task[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const orderedTasks = useMemo(() => {
    const statusRank = { blocked: 0, in_progress: 1, todo: 2, done: 3 } as const;
    return [...tasks].sort((left, right) => {
      const statusDifference = statusRank[left.status] - statusRank[right.status];
      if (statusDifference) return statusDifference;
      const priorityDifference = left.priority - right.priority;
      if (priorityDifference) return priorityDifference;
      return (left.dueDate ?? Number.MAX_SAFE_INTEGER) - (right.dueDate ?? Number.MAX_SAFE_INTEGER);
    });
  }, [tasks]);

  async function changePriority(taskId: string, priority: number) {
    try {
      await updateTask(db, taskId, { priority });
      setActionError(null);
    } catch {
      setActionError("This priority change could not be saved. Please try again.");
    }
  }

  return (
    <div className="portal-application">
      <div className="portal-application-heading"><div><span>Application</span><strong>{application.name}</strong></div><small>{tasks.length} task{tasks.length === 1 ? "" : "s"}</small></div>
      {actionError && <p className="portal-task-error" role="alert">{actionError}</p>}
      {tasks.length === 0 ? <div className="application-empty"><CheckCircle2 /> No tasks have been added to this application.</div> :
      <div className="portal-task-list">
        {orderedTasks.map((t) => (
          <article className="portal-task" key={t.id}>
            <div className="portal-task-summary">
              <div className="portal-task-copy"><strong>{t.title}</strong><span>{t.dueDate ? `Due ${new Date(t.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "No due date"}</span></div>
              <StatusTag tone={STATUS_TONE[t.status]}>{t.status.replace("_", " ")}</StatusTag>
            </div>
            <div className="portal-task-actions">
              <div className="portal-priority"><span>Priority</span><PrioritySelect value={t.priority} label={`Priority for ${t.title}`} onChange={(priority) => changePriority(t.id, priority)} /></div>
              <Button variant="ghost" size="sm" onPress={() => setOpen(open === t.id ? null : t.id)}><MessageSquare />{open === t.id ? "Hide discussion" : "Discuss"}</Button>
            </div>
            {open === t.id && <div className="portal-task-detail"><Comments taskId={t.id} clientId={t.clientId} authorType="client" /><Documents ownerType="task" ownerId={t.id} clientId={t.clientId} canEdit={false} /></div>}
          </article>
        ))}
      </div>}
    </div>
  );
}

function ProjectBlock({ project, applications, tasks }: { project: Project; applications: Application[]; tasks: Task[] }) {
  return (
    <section className="portal-project">
      <div className="portal-project-heading"><div><span>Project</span><h3>{project.name}</h3></div><small>{applications.length} application{applications.length === 1 ? "" : "s"}</small></div>
      {applications.length === 0 && <div className="application-empty"><CheckCircle2 /> No applications have been added to this project.</div>}
      {applications.map((application) => <AppTasks key={application.id} application={application} tasks={tasks.filter((task) => task.applicationId === application.id)} />)}
    </section>
  );
}

export function ClientPortal({ clientId }: { clientId: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [projectsError, setProjectsError] = useState(false);
  const [activeSection, setActiveSection] = useState<"overview" | "delivery" | "documents" | "invoices">("overview");
  useEffect(() => {
    const syncSectionFromHash = () => {
      const section = window.location.hash.slice(1);
      if (section === "delivery" || section === "documents" || section === "invoices" || section === "overview") setActiveSection(section);
    };
    syncSectionFromHash();
    window.addEventListener("hashchange", syncSectionFromHash);
    return () => window.removeEventListener("hashchange", syncSectionFromHash);
  }, []);
  useEffect(() => {
    setProjectsLoading(true);
    return subscribeProjectsByClient(db, clientId, (items) => {
      setProjects(items); setProjectsError(false); setProjectsLoading(false);
    }, () => { setProjectsError(true); setProjectsLoading(false); });
  }, [clientId]);
  useEffect(() => subscribeClient(db, clientId, setClient, () => setClient(null)), [clientId]);
  useEffect(() => {
    setApplicationsLoading(true);
    return subscribeApplicationsByClient(db, clientId, (items) => { setApplications(items); setApplicationsLoading(false); }, () => { setProjectsError(true); setApplicationsLoading(false); });
  }, [clientId]);
  useEffect(() => {
    setTasksLoading(true);
    return subscribeTasks(db, { clientId }, (items) => { setTasks(items); setTasksLoading(false); }, () => { setProjectsError(true); setTasksLoading(false); });
  }, [clientId]);

  const delivery = useMemo(() => {
    const activeProjectIds = new Set(projects.filter((project) => project.status === "active").map((project) => project.id));
    const activeApplications = applications.filter((application) => application.status === "active" && activeProjectIds.has(application.projectId));
    const activeApplicationIds = new Set(activeApplications.map((application) => application.id));
    const activeTasks = tasks.filter((task) => activeApplicationIds.has(task.applicationId));
    const open = activeTasks.filter((task) => task.status !== "done").length;
    const complete = activeTasks.filter((task) => task.status === "done").length;
    const blocked = activeTasks.filter((task) => task.status === "blocked").length;
    return { activeProjects: activeProjectIds.size, activeApplications: activeApplications.length, open, complete, blocked };
  }, [projects, applications, tasks]);
  const deliveryLoading = projectsLoading || applicationsLoading || tasksLoading;

  return (
    <div className="portal-shell">
      <a className="skip-link" href="#portal-main-content">Skip to main content</a>
      <aside className="portal-sidebar">
        <BrandLogo />
        <div className="portal-client"><span className="client-avatar">{client?.name.slice(0, 2).toUpperCase() ?? "…"}</span><div><strong>{client?.name ?? "Loading"}</strong><small>Client portal</small></div></div>
        <nav aria-label="Client portal sections">
          <a className={activeSection === "overview" ? "active" : ""} aria-current={activeSection === "overview" ? "page" : undefined} href="#overview" onClick={() => setActiveSection("overview")}><LayoutDashboard /> Overview</a>
          <a className={activeSection === "delivery" ? "active" : ""} aria-current={activeSection === "delivery" ? "page" : undefined} href="#delivery" onClick={() => setActiveSection("delivery")}><FolderKanban /> Delivery</a>
          <a className={activeSection === "documents" ? "active" : ""} aria-current={activeSection === "documents" ? "page" : undefined} href="#documents" onClick={() => setActiveSection("documents")}><FileText /> Documents</a>
          <a className={activeSection === "invoices" ? "active" : ""} aria-current={activeSection === "invoices" ? "page" : undefined} href="#invoices" onClick={() => setActiveSection("invoices")}><ReceiptText /> Invoices</a>
        </nav>
        <div className="portal-footer"><ThemeToggle /><Button variant="ghost" onPress={() => signOut(fb.auth)}><LogOut /> Sign out</Button></div>
      </aside>
      <section className="portal-main">
        <header className="workspace-toolbar"><div className="toolbar-context"><span>Client portal</span><i>/</i><strong>{PORTAL_SECTION_LABEL[activeSection]}</strong></div><div className="toolbar-actions"><NotificationBell subscribeNotifications={(onData, onError) => subscribeClientNotifications(db, clientId, onData, onError)} /></div></header>
        <main id="portal-main-content" className="workspace-content content-stack" tabIndex={-1}>
          <span id="overview" className="portal-overview-anchor" aria-hidden="true" />
          <PageHeader eyebrow="Client portal" title={`Welcome, ${client?.name ?? "client"}`} description="Follow delivery progress, conversations, files, and billing." />
          <section className="context-visual portal-overview-visual"><img src="/visuals/client-network.jpg" alt="Abstract connected client network" /><div><span>Your connected workspace</span><strong>One view from engagement to delivery.</strong><p>Projects, applications, tasks, conversations, documents, and billing stay connected here.</p></div></section>
          <section className="portal-delivery-summary" aria-label="Delivery summary">
            <div><span>Projects</span><strong>{delivery.activeProjects}</strong><small>Active delivery streams</small></div>
            <div><span>Applications</span><strong>{delivery.activeApplications}</strong><small>Active workspaces</small></div>
            <div><span>Open tasks</span><strong>{delivery.open}</strong><small>{delivery.blocked ? `${delivery.blocked} need attention` : "Moving forward"}</small></div>
            <div><span>Completed</span><strong>{delivery.complete}</strong><small>Delivered tasks</small></div>
          </section>
          <section id="delivery" className="portal-section"><div className="section-heading"><div><h2>Your projects</h2><p>Current delivery work, applications, and task status.</p></div></div>
          {deliveryLoading && <div className="portal-project-loading" role="status" aria-label="Loading projects">{[1, 2].map((item) => <div key={item}><Skeleton className="h-5 w-40" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>)}</div>}
          {projectsError && <p className="empty-state">Projects could not be loaded. Sign out and back in, then retry.</p>}
          {!deliveryLoading && !projectsError && projects.length === 0 && <p className="empty-state">No projects yet.</p>}
          {!deliveryLoading && !projectsError && projects.map((project) => <ProjectBlock key={project.id} project={project} applications={applications.filter((application) => application.projectId === project.id)} tasks={tasks.filter((task) => task.projectId === project.id)} />)}
          </section>
          <section id="documents" className="portal-section"><div className="section-heading"><div><h2>Documents</h2><p>Files and links shared with your account, projects, applications, and tasks.</p></div></div><div className="portal-surface"><ClientSharedDocuments clientId={clientId} /></div></section>
          <section id="invoices" className="portal-section"><div className="section-heading"><div><h2>Invoices</h2><p>Your latest billing records.</p></div></div><InvoicesPanel clientId={clientId} canEdit={false} /></section>
        </main>
      </section>
    </div>
  );
}
