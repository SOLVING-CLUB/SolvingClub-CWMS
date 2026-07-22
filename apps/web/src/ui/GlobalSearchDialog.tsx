import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  subscribeApplications, subscribeClients, subscribeProjects, subscribeTasks,
  type Application, type Client, type Project, type Task,
} from "@solvingclub/core";
import { Boxes, BriefcaseBusiness, FolderKanban, LayoutDashboard, Plus, Search, SquareCheckBig, Users } from "lucide-react";
import { db } from "../db";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { priorityMeta } from "./PrioritySelect";
import { canAdmin, useSession } from "../auth/SessionContext";

type SearchGroup = "Quick actions" | "Clients" | "Projects" | "Applications" | "Tasks";
type SearchItem = { id: string; group: SearchGroup; title: string; detail: string; path: string };

export function GlobalSearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const session = useSession();
  const editable = canAdmin(session.role);
  const navigate = useNavigate();
  const resultsRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery(""); setLoading(true); setError(false);
    let ready = 0;
    const done = () => { ready += 1; if (ready === 4) setLoading(false); };
    const failed = () => { setError(true); setLoading(false); };
    const stopClients = subscribeClients(db, (items) => { setClients(items); done(); }, failed);
    const stopProjects = subscribeProjects(db, (items) => { setProjects(items); done(); }, failed);
    const stopApplications = subscribeApplications(db, (items) => { setApplications(items); done(); }, failed);
    const stopTasks = subscribeTasks(db, {}, (items) => { setTasks(items); done(); }, failed);
    return () => { stopClients(); stopProjects(); stopApplications(); stopTasks(); };
  }, [open]);

  const clientNames = useMemo(() => new Map(clients.map((client) => [client.id, client.name])), [clients]);
  const projectNames = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  const items = useMemo<SearchItem[]>(() => {
    const term = query.trim().toLocaleLowerCase();
    const matches = (value: string) => !term || value.toLocaleLowerCase().includes(term);
    const limit = term ? 6 : 4;
    return [
      ...[
        { id: "overview", group: "Quick actions" as const, title: "Go to overview", detail: "Workspace pulse and attention queue", path: "/" },
        { id: "work", group: "Quick actions" as const, title: "Open all work", detail: "Filter delivery work across clients", path: "/work" },
        { id: "projects", group: "Quick actions" as const, title: "Browse projects", detail: "All delivery streams", path: "/projects" },
        { id: "applications", group: "Quick actions" as const, title: "Browse applications", detail: "All delivery workspaces", path: "/applications" },
        ...(editable ? [{ id: "new-client", group: "Quick actions" as const, title: "Create a client", detail: "Start a new client workspace", path: "/clients?new=1" }] : []),
        ...(session.role === "owner" ? [{ id: "members", group: "Quick actions" as const, title: "Manage members", detail: "Team access and roles", path: "/members" }] : []),
      ].filter((item) => matches(`${item.title} ${item.detail}`)),
      ...clients.filter((client) => matches(`${client.name} ${client.email}`)).slice(0, limit).map((client) => ({ id: client.id, group: "Clients" as const, title: client.name, detail: client.email, path: `/clients/${client.id}` })),
      ...projects.filter((project) => matches(`${project.name} ${clientNames.get(project.clientId) ?? ""}`)).slice(0, limit).map((project) => ({ id: project.id, group: "Projects" as const, title: project.name, detail: clientNames.get(project.clientId) ?? "Client project", path: `/projects/${project.id}` })),
      ...applications.filter((application) => matches(`${application.name} ${projectNames.get(application.projectId) ?? ""} ${clientNames.get(application.clientId) ?? ""}`)).slice(0, limit).map((application) => ({ id: application.id, group: "Applications" as const, title: application.name, detail: `${clientNames.get(application.clientId) ?? "Client"} · ${projectNames.get(application.projectId) ?? "Project"}`, path: `/applications/${application.clientId}/${application.id}` })),
      ...tasks.filter((task) => task.status !== "done" && matches(`${task.title} ${clientNames.get(task.clientId) ?? ""} ${projectNames.get(task.projectId) ?? ""}`)).slice(0, limit).map((task) => ({ id: task.id, group: "Tasks" as const, title: task.title, detail: `${task.status.replace("_", " ")} · ${priorityMeta(task.priority).label}`, path: `/applications/${task.clientId}/${task.applicationId}` })),
    ];
  }, [applications, clientNames, clients, editable, projectNames, projects, query, session.role, tasks]);

  const groups = useMemo(() => ["Quick actions", "Clients", "Projects", "Applications", "Tasks"].map((name) => ({ name, items: items.filter((item) => item.group === name) })).filter((group) => group.items.length), [items]);
  function go(path: string) { onOpenChange(false); navigate(path); }
  function resultButtons() { return Array.from(resultsRef.current?.querySelectorAll<HTMLButtonElement>("button[data-search-result]") ?? []); }
  function moveFrom(index: number, direction: 1 | -1) {
    const buttons = resultButtons();
    if (!buttons.length) return;
    buttons[(index + direction + buttons.length) % buttons.length]?.focus();
  }

  const icons = { "Quick actions": LayoutDashboard, Clients: BriefcaseBusiness, Projects: FolderKanban, Applications: Boxes, Tasks: SquareCheckBig };
  return <Dialog isOpen={open} onOpenChange={onOpenChange} className="search-dialog" showCloseButton={false}>
    <DialogHeader className="sr-only"><DialogTitle>Search workspace</DialogTitle><DialogDescription>Find clients, projects, applications, and tasks.</DialogDescription></DialogHeader>
    <div className="search-input"><Search /><Input autoFocus aria-label="Search workspace" placeholder="Search the entire workspace…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(event) => {
      if (event.key === "ArrowDown") { event.preventDefault(); resultButtons()[0]?.focus(); }
      if (event.key === "Enter" && items[0]) { event.preventDefault(); go(items[0].path); }
    }} /></div>
    <div className="search-results" ref={resultsRef}>
      {loading && <div className="search-loading" role="status" aria-label="Searching workspace"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>}
      {error && <div className="quiet-empty" role="alert">Search could not load. Close and try again.</div>}
      {!loading && !error && groups.map((group) => <section key={group.name}><h3>{group.name}</h3>{group.items.map((item) => {
        const Icon = item.id === "new-client" ? Plus : item.id === "members" ? Users : icons[item.group];
        return <button data-search-result key={`${item.group}-${item.id}`} onClick={() => go(item.path)} onKeyDown={(event) => {
          const index = resultButtons().indexOf(event.currentTarget);
          if (event.key === "ArrowDown") { event.preventDefault(); moveFrom(index, 1); }
          if (event.key === "ArrowUp") { event.preventDefault(); index === 0 ? document.querySelector<HTMLInputElement>(".search-input input")?.focus() : moveFrom(index, -1); }
        }}><Icon /><span><strong>{item.title}</strong><small>{item.detail}</small></span></button>;
      })}</section>)}
      {!loading && !error && !items.length && <div className="quiet-empty">No results for “{query}”.</div>}
    </div>
    <footer className="search-footer"><span>↑↓ Navigate</span><span>↵ Open</span><span>esc Close</span></footer>
  </Dialog>;
}
