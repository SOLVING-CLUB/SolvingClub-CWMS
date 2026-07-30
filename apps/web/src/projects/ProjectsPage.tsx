import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createProject, subscribeApplications, subscribeClients, subscribeProjects, subscribeTasks, type Application, type Client, type Project, type Task } from "@solvingclub/core";
import { ArrowRight, FolderKanban, Plus, Search } from "lucide-react";
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

export function ProjectsPage() {
  const session = useSession();
  const editable = canAdmin(session.role);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"active" | "archived" | "all">("active");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let ready = 0;
    const done = () => { ready += 1; if (ready === 4) setLoading(false); };
    const stopProjects = subscribeProjects(db, (items) => { setProjects(items); done(); });
    const stopClients = subscribeClients(db, (items) => { setClients(items); done(); });
    const stopApplications = subscribeApplications(db, (items) => { setApplications(items); done(); });
    const stopTasks = subscribeTasks(db, {}, (items) => { setTasks(items); done(); });
    return () => { stopProjects(); stopClients(); stopApplications(); stopTasks(); };
  }, []);

  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    const clientById = new Map(clients.map((client) => [client.id, client]));
    return projects.filter((project) => (scope === "all" || project.status === scope)
      && (!query || `${project.name} ${clientById.get(project.clientId)?.name ?? ""}`.toLowerCase().includes(query)))
      .map((project) => {
        const projectApplications = applications.filter((application) => application.projectId === project.id);
        const projectTasks = tasks.filter((task) => task.projectId === project.id);
        const complete = projectTasks.filter((task) => task.status === "done").length;
        return { project, client: clientById.get(project.clientId), applicationCount: projectApplications.length, taskCount: projectTasks.length, complete };
      });
  }, [projects, clients, applications, tasks, search, scope]);
  const activeProjects = projects.filter((project) => project.status === "active").length;
  const archivedProjects = projects.length - activeProjects;
  const emptyTitle = projects.length === 0 ? "No projects yet" : scope === "active" ? "No active projects" : scope === "archived" ? "No archived projects" : "No matching projects";
  const emptyDescription = projects.length === 0 ? "Projects will appear here once they are created for a client." : scope === "all" ? "Try a different project or client name." : `Switch to ${scope === "active" ? "Archived" : "Active"} to view those delivery streams.`;

  async function createNewProject() {
    if (!name.trim() || !clientId) return;
    setBusy(true); setCreateError(null);
    try { await createProject(db, { clientId, name, ...(description.trim() ? { description: description.trim() } : {}) }); setCreating(false); setName(""); setDescription(""); setClientId(""); }
    catch (cause) { setCreateError(cause instanceof Error ? cause.message : "The project could not be created."); }
    finally { setBusy(false); }
  }
  function submitNewProject(event: React.FormEvent) { event.preventDefault(); void createNewProject(); }

  return <div className="content-stack entity-page">
    <PageHeader eyebrow="Delivery structure" title="Projects" description="Every delivery stream, across every client." actions={editable ? <Button onPress={() => { setCreateError(null); setDescription(""); setCreating(true); }}><Plus /> New project</Button> : undefined} />
    <DeliveryTabs projects={projects.length} applications={applications.length} />
    <div className="entity-scope" aria-label="Project visibility"><button type="button" className={scope === "active" ? "active" : ""} aria-pressed={scope === "active"} onClick={() => setScope("active")}>Active <span>{activeProjects}</span></button><button type="button" className={scope === "archived" ? "active" : ""} aria-pressed={scope === "archived"} onClick={() => setScope("archived")}>Archived <span>{archivedProjects}</span></button><button type="button" className={scope === "all" ? "active" : ""} aria-pressed={scope === "all"} onClick={() => setScope("all")}>All <span>{projects.length}</span></button></div>
    <div className="collection-toolbar"><div className="collection-search"><Search /><Input aria-label="Search projects" placeholder="Search projects or clients…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><span>{results.length} of {projects.length}</span></div>
    {loading ? <div className="entity-grid">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-44 w-full" />)}</div> : results.length === 0 ? <EmptyState icon={<FolderKanban />} title={emptyTitle} description={emptyDescription} imageSrc="/visuals/delivery-routing.jpg" imageAlt="Abstract delivery routing system" /> : <div className="entity-grid">
      {results.map(({ project, client, applicationCount, taskCount, complete }) => <Link key={project.id} className="entity-card" to={`/projects/${project.id}`}>
        <span className="entity-icon"><FolderKanban /></span><div className="entity-copy"><span>{client?.name ?? "Client"}</span><strong>{project.name}</strong><p>{applicationCount} application{applicationCount === 1 ? "" : "s"} · {taskCount} task{taskCount === 1 ? "" : "s"}</p></div>
        <div className="entity-progress"><span>{taskCount ? `${complete}/${taskCount} complete` : "No tasks yet"}</span><i><b style={{ width: `${taskCount ? Math.round(complete / taskCount * 100) : 0}%` }} /></i></div><ArrowRight />
      </Link>)}
    </div>}
    <Dialog isOpen={creating} onOpenChange={setCreating}>
      <DialogHeader><DialogTitle>New project</DialogTitle><DialogDescription>Choose the client relationship this delivery stream belongs to.</DialogDescription></DialogHeader>
      <form id="new-project-form" className="dialog-form" onSubmit={submitNewProject}><div><Label htmlFor="new-project-client">Client</Label><NativeSelect id="new-project-client" value={clientId} onChange={(event) => setClientId(event.target.value)}><NativeSelectOption value="">Choose a client</NativeSelectOption>{clients.map((client) => <NativeSelectOption key={client.id} value={client.id}>{client.name}</NativeSelectOption>)}</NativeSelect></div><div><Label htmlFor="new-project-name">Project name</Label><Input id="new-project-name" autoFocus placeholder="Website redesign" value={name} maxLength={160} onChange={(event) => setName(event.target.value)} /></div><div><Label htmlFor="new-project-description">Delivery brief <span>Optional</span></Label><Textarea id="new-project-description" placeholder="What outcome should this project deliver?" value={description} maxLength={4000} onChange={(event) => setDescription(event.target.value)} /></div>{createError && <p className="form-error" role="alert">{createError}</p>}</form>
      <DialogFooter showCloseButton><Button type="submit" form="new-project-form" isDisabled={busy || !clientId || !name.trim()}>{busy ? "Creating…" : "Create project"}</Button></DialogFooter>
    </Dialog>
  </div>;
}
