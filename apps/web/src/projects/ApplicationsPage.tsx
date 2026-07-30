import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createApplication, subscribeApplications, subscribeClients, subscribeProjects, subscribeTasks, type Application, type Client, type Project, type Task } from "@solvingclub/core";
import { ArrowRight, Boxes, Plus, Search } from "lucide-react";
import { db } from "../db";
import { PageHeader } from "../ui/PageHeader";
import { EmptyState } from "../ui/EmptyState";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { canAdmin, useSession } from "../auth/SessionContext";
import { DeliveryTabs } from "../ui/DeliveryTabs";

export function ApplicationsPage() {
  const session = useSession();
  const editable = canAdmin(session.role);
  const [applications, setApplications] = useState<Application[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"active" | "archived" | "all">("active");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let ready = 0;
    const done = () => { ready += 1; if (ready === 4) setLoading(false); };
    const stopApplications = subscribeApplications(db, (items) => { setApplications(items); done(); });
    const stopProjects = subscribeProjects(db, (items) => { setProjects(items); done(); });
    const stopClients = subscribeClients(db, (items) => { setClients(items); done(); });
    const stopTasks = subscribeTasks(db, {}, (items) => { setTasks(items); done(); });
    return () => { stopApplications(); stopProjects(); stopClients(); stopTasks(); };
  }, []);

  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    const projectById = new Map(projects.map((project) => [project.id, project]));
    const clientById = new Map(clients.map((client) => [client.id, client]));
    return applications.filter((application) => (scope === "all" || application.status === scope)
      && (!query || [application.name, application.type, projectById.get(application.projectId)?.name, clientById.get(application.clientId)?.name].filter(Boolean).join(" ").toLowerCase().includes(query)))
      .map((application) => {
        const applicationTasks = tasks.filter((task) => task.applicationId === application.id);
        const complete = applicationTasks.filter((task) => task.status === "done").length;
        return { application, project: projectById.get(application.projectId), client: clientById.get(application.clientId), taskCount: applicationTasks.length, complete };
      });
  }, [applications, projects, clients, tasks, search, scope]);
  const activeApplications = applications.filter((application) => application.status === "active").length;
  const archivedApplications = applications.length - activeApplications;
  const emptyTitle = applications.length === 0 ? "No applications yet" : scope === "active" ? "No active applications" : scope === "archived" ? "No archived applications" : "No matching applications";
  const emptyDescription = applications.length === 0 ? "Applications will appear here when delivery workstreams are created." : scope === "all" ? "Try a different application, project, or client name." : `Switch to ${scope === "active" ? "Archived" : "Active"} to view those workstreams.`;

  const availableProjects = projects.filter((project) => project.clientId === clientId && project.status === "active");
  async function createNewApplication() {
    if (!clientId || !projectId || !name.trim()) return;
    setBusy(true); setCreateError(null);
    try { await createApplication(db, { clientId, projectId, name, ...(type.trim() ? { type: type.trim() } : {}), ...(description.trim() ? { description: description.trim() } : {}) }); setCreating(false); setClientId(""); setProjectId(""); setName(""); setType(""); setDescription(""); }
    catch (cause) { setCreateError(cause instanceof Error ? cause.message : "The application could not be created."); }
    finally { setBusy(false); }
  }
  function submitNewApplication(event: React.FormEvent) { event.preventDefault(); void createNewApplication(); }

  return <div className="content-stack entity-page">
    <PageHeader eyebrow="Delivery structure" title="Applications" description="Workstreams, delivery context, and their task progress." actions={editable ? <Button onPress={() => { setCreateError(null); setType(""); setDescription(""); setCreating(true); }}><Plus /> New application</Button> : undefined} />
    <DeliveryTabs projects={projects.length} applications={applications.length} />
    <div className="entity-scope" aria-label="Application visibility"><button type="button" className={scope === "active" ? "active" : ""} aria-pressed={scope === "active"} onClick={() => setScope("active")}>Active <span>{activeApplications}</span></button><button type="button" className={scope === "archived" ? "active" : ""} aria-pressed={scope === "archived"} onClick={() => setScope("archived")}>Archived <span>{archivedApplications}</span></button><button type="button" className={scope === "all" ? "active" : ""} aria-pressed={scope === "all"} onClick={() => setScope("all")}>All <span>{applications.length}</span></button></div>
    <div className="collection-toolbar"><div className="collection-search"><Search /><Input aria-label="Search applications" placeholder="Search applications, projects, or clients…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><span>{results.length} of {applications.length}</span></div>
    {loading ? <div className="entity-grid">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-44 w-full" />)}</div> : results.length === 0 ? <EmptyState icon={<Boxes />} title={emptyTitle} description={emptyDescription} imageSrc="/visuals/delivery-routing.jpg" imageAlt="Abstract delivery routing system" /> : <div className="entity-grid">
      {results.map(({ application, project, client, taskCount, complete }) => <Link key={application.id} className="entity-card" to={`/applications/${application.clientId}/${application.id}`}>
        <span className="entity-icon"><Boxes /></span><div className="entity-copy"><span>{client?.name ?? "Client"} <i>/</i> {project?.name ?? "Project"}</span><strong>{application.name}</strong><p>{application.type ?? "Delivery workstream"} · {taskCount} task{taskCount === 1 ? "" : "s"}</p></div>
        <div className="entity-progress"><span>{taskCount ? `${complete}/${taskCount} complete` : "No tasks yet"}</span><i><b style={{ width: `${taskCount ? Math.round(complete / taskCount * 100) : 0}%` }} /></i></div><ArrowRight />
      </Link>)}
    </div>}
    <Dialog isOpen={creating} onOpenChange={setCreating}>
      <DialogHeader><DialogTitle>New application</DialogTitle><DialogDescription>Add a workstream to an existing project.</DialogDescription></DialogHeader>
      <form id="new-application-form" className="dialog-form" onSubmit={submitNewApplication}><div><Label htmlFor="new-application-client">Client</Label><NativeSelect id="new-application-client" value={clientId} onChange={(event) => { setClientId(event.target.value); setProjectId(""); }}><NativeSelectOption value="">Choose a client</NativeSelectOption>{clients.map((client) => <NativeSelectOption key={client.id} value={client.id}>{client.name}</NativeSelectOption>)}</NativeSelect></div><div><Label htmlFor="new-application-project">Project</Label><NativeSelect id="new-application-project" disabled={!clientId} value={projectId} onChange={(event) => setProjectId(event.target.value)}><NativeSelectOption value="">Choose a project</NativeSelectOption>{availableProjects.map((project) => <NativeSelectOption key={project.id} value={project.id}>{project.name}</NativeSelectOption>)}</NativeSelect></div><div><Label htmlFor="new-application-name">Application name</Label><Input id="new-application-name" autoFocus placeholder="Client portal" value={name} maxLength={160} onChange={(event) => setName(event.target.value)} /></div><div><Label htmlFor="new-application-type">Type <span>Optional</span></Label><Input id="new-application-type" placeholder="Website, API, campaign…" value={type} maxLength={80} onChange={(event) => setType(event.target.value)} /></div><div><Label htmlFor="new-application-description">Delivery brief <span>Optional</span></Label><Textarea id="new-application-description" placeholder="What should this workstream accomplish?" value={description} maxLength={4000} onChange={(event) => setDescription(event.target.value)} /></div>{createError && <p className="form-error" role="alert">{createError}</p>}</form>
      <DialogFooter showCloseButton><Button type="submit" form="new-application-form" isDisabled={busy || !clientId || !projectId || !name.trim()}>{busy ? "Creating…" : "Create application"}</Button></DialogFooter>
    </Dialog>
  </div>;
}
