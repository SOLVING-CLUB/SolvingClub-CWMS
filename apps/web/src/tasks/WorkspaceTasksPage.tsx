import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  subscribeApplications, subscribeClients, subscribeMembers, subscribeProjects, subscribeTasks, updateTask,
  type Application, type Client, type Member, type Project, type Task, type TaskStatus,
} from "@solvingclub/core";
import { ArrowRight, CalendarClock, CheckSquare2, CircleAlert, Filter, Pencil, Search, X } from "lucide-react";
import { db } from "../db";
import { PageHeader } from "../ui/PageHeader";
import { EmptyState } from "../ui/EmptyState";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { StatusSelect, type StatusTone } from "../ui/StatusTag";
import { canAdmin, useSession } from "../auth/SessionContext";
import { PRIORITIES, PrioritySelect } from "../ui/PrioritySelect";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskEditDialog } from "./TaskEditDialog";
import { canEditTask } from "../lib/workspace";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];
const TONES: Record<TaskStatus, StatusTone> = { todo: "neutral", in_progress: "progress", blocked: "blocked", done: "done" };
type DeadlineFilter = "" | "overdue" | "today" | "week" | "none";

function dayBounds() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

function dueLabel(dueDate?: number) {
  if (!dueDate) return "No due date";
  const { start } = dayBounds();
  const days = Math.floor((dueDate - start) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return new Date(dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function WorkspaceTasksPage() {
  const session = useSession();
  const admin = canAdmin(session.role);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [assignee, setAssignee] = useState("");
  const [clientId, setClientId] = useState("");
  const [priority, setPriority] = useState("");
  const [deadline, setDeadline] = useState<DeadlineFilter>("");
  const [search, setSearch] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let readyCount = 0;
    setLoading(true); setError(false);
    const ready = () => { readyCount += 1; if (readyCount === 5) setLoading(false); };
    const failed = () => { setError(true); setLoading(false); };
    const stopTasks = subscribeTasks(db, {}, (items) => { setTasks(items); ready(); }, failed);
    const stopMembers = subscribeMembers(db, (items) => { setMembers(items); ready(); }, failed);
    const stopClients = subscribeClients(db, (items) => { setClients(items); ready(); }, failed);
    const stopProjects = subscribeProjects(db, (items) => { setProjects(items); ready(); }, failed);
    const stopApplications = subscribeApplications(db, (items) => { setApplications(items); ready(); }, failed);
    return () => { stopTasks(); stopMembers(); stopClients(); stopProjects(); stopApplications(); };
  }, []);

  const { visible, counts, clientMap, projectMap, applicationMap } = useMemo(() => {
    const now = Date.now();
    const { start, end } = dayBounds();
    const normalized = search.trim().toLowerCase();
    const clientLookup = new Map(clients.map((item) => [item.id, item]));
    const projectLookup = new Map(projects.map((item) => [item.id, item]));
    const applicationLookup = new Map(applications.map((item) => [item.id, item]));
    const result = tasks.filter((task) => {
      if (status && task.status !== status) return false;
      if (assignee === "__unassigned" && task.assigneeUid) return false;
      if (assignee && assignee !== "__unassigned" && task.assigneeUid !== assignee) return false;
      if (clientId && task.clientId !== clientId) return false;
      if (priority && task.priority !== Number(priority)) return false;
      if (deadline === "overdue" && (!task.dueDate || task.dueDate >= start || task.status === "done")) return false;
      if (deadline === "today" && (!task.dueDate || task.dueDate < start || task.dueDate >= end)) return false;
      if (deadline === "week" && (!task.dueDate || task.dueDate < start || task.dueDate >= start + 7 * 86_400_000)) return false;
      if (deadline === "none" && task.dueDate) return false;
      if (normalized) {
        const haystack = [task.title, task.description, clientLookup.get(task.clientId)?.name,
          projectLookup.get(task.projectId)?.name, applicationLookup.get(task.applicationId)?.name].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(normalized)) return false;
      }
      return true;
    });
    return {
      visible: result,
      counts: {
        open: tasks.filter((task) => task.status !== "done").length,
        blocked: tasks.filter((task) => task.status === "blocked").length,
        overdue: tasks.filter((task) => task.status !== "done" && task.dueDate && task.dueDate < now).length,
        unassigned: tasks.filter((task) => !task.assigneeUid && task.status !== "done").length,
      },
      clientMap: clientLookup, projectMap: projectLookup, applicationMap: applicationLookup,
    };
  }, [tasks, clients, projects, applications, status, assignee, clientId, priority, deadline, search]);

  const filtersActive = Boolean(status || assignee || clientId || priority || deadline || search);
  function clearFilters() { setStatus(""); setAssignee(""); setClientId(""); setPriority(""); setDeadline(""); setSearch(""); }

  return (
    <div className="content-stack work-command-page">
      <PageHeader eyebrow="Delivery control" title="All work" description="Find risk, ownership, and deadlines across every client." />

      <section className="work-command-hero"><div className="work-command-summary" aria-label="Work summary">
        <button type="button" onClick={() => { clearFilters(); }}><span>Open</span><strong>{counts.open}</strong></button>
        <button type="button" onClick={() => { clearFilters(); setStatus("blocked"); }}><span>Blocked</span><strong>{counts.blocked}</strong></button>
        <button type="button" onClick={() => { clearFilters(); setDeadline("overdue"); }}><span>Overdue</span><strong>{counts.overdue}</strong></button>
        <button type="button" onClick={() => { clearFilters(); setAssignee("__unassigned"); }}><span>Unassigned</span><strong>{counts.unassigned}</strong></button>
      </div><img src="/visuals/delivery-routing.jpg" alt="Abstract delivery routing system" /></section>

      <div className="work-command-filters">
        <div className="work-search"><Search /><Input aria-label="Search work" placeholder="Search tasks, clients, projects…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="work-filter-row"><Filter />
          <NativeSelect aria-label="Client" value={clientId} onChange={(e) => setClientId(e.target.value)}><NativeSelectOption value="">All clients</NativeSelectOption>{clients.map((client) => <NativeSelectOption key={client.id} value={client.id}>{client.name}</NativeSelectOption>)}</NativeSelect>
          <NativeSelect aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus | "")}><NativeSelectOption value="">All statuses</NativeSelectOption>{STATUSES.map((item) => <NativeSelectOption key={item} value={item}>{item.replace("_", " ")}</NativeSelectOption>)}</NativeSelect>
          <NativeSelect aria-label="Assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}><NativeSelectOption value="">All assignees</NativeSelectOption><NativeSelectOption value="__unassigned">Unassigned</NativeSelectOption>{members.map((member) => <NativeSelectOption key={member.uid} value={member.uid}>{member.name}</NativeSelectOption>)}</NativeSelect>
          <NativeSelect aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}><NativeSelectOption value="">All priorities</NativeSelectOption>{PRIORITIES.map((item) => <NativeSelectOption key={item.value} value={item.value}>{item.label}</NativeSelectOption>)}</NativeSelect>
          <NativeSelect aria-label="Deadline" value={deadline} onChange={(e) => setDeadline(e.target.value as DeadlineFilter)}><NativeSelectOption value="">Any deadline</NativeSelectOption><NativeSelectOption value="overdue">Overdue</NativeSelectOption><NativeSelectOption value="today">Due today</NativeSelectOption><NativeSelectOption value="week">Next 7 days</NativeSelectOption><NativeSelectOption value="none">No due date</NativeSelectOption></NativeSelect>
          {filtersActive && <Button variant="ghost" size="sm" onPress={clearFilters}><X /> Clear</Button>}
          <span className="work-result-count">{visible.length} of {tasks.length}</span>
        </div>
      </div>

      {error && <div className="data-error" role="alert"><CircleAlert /> Work could not be loaded. Refresh the page to try again.</div>}
      {loading ? <div className="work-list work-loading">{[1,2,3,4,5].map((item) => <Skeleton key={item} className="h-14 w-full" />)}</div> : visible.length === 0 ? <EmptyState icon={<CheckSquare2 />} title={filtersActive ? "No matching work" : "Queue is clear"} description={filtersActive ? "Clear a filter or broaden your search." : "New tasks will appear here as delivery work is created."} action={filtersActive ? <Button variant="outline" onPress={clearFilters}>Clear filters</Button> : undefined} imageSrc="/visuals/delivery-routing.jpg" imageAlt="Abstract delivery routing system" /> : (
        <div className="work-list command-work-list">
          <div className="work-list-head"><span>Status</span><span>Task and context</span><span>Owner</span><span>Priority</span><span>Deadline</span><span /></div>
          {visible.map((task) => {
            const editable = canEditTask(admin, session.uid, task.assigneeUid);
            const overdue = task.status !== "done" && Boolean(task.dueDate && task.dueDate < Date.now());
            return <div className={`command-work-item${overdue ? " overdue" : ""}`} key={task.id}>
              <StatusSelect isDisabled={!editable} value={task.status} tone={TONES[task.status]} options={STATUSES} onChange={(next) => updateTask(db, task.id, { status: next })} />
              <Link className="work-context" to={`/applications/${task.clientId}/${task.applicationId}`}>
                <strong>{task.title}</strong><span>{clientMap.get(task.clientId)?.name ?? "Client"} <i>/</i> {projectMap.get(task.projectId)?.name ?? "Project"} <i>/</i> {applicationMap.get(task.applicationId)?.name ?? "Application"}</span>
              </Link>
              <span className="work-owner">{task.assigneeUid ? members.find((member) => member.uid === task.assigneeUid)?.name ?? "Assigned" : "Unassigned"}</span>
              <PrioritySelect isDisabled={!editable} value={task.priority} label={`Priority for ${task.title}`} onChange={(next) => updateTask(db, task.id, { priority: next })} />
              <time className={overdue ? "overdue" : ""}><CalendarClock />{dueLabel(task.dueDate)}</time>
              <div className="work-row-actions"><Button aria-label={`Edit ${task.title}`} isDisabled={!editable} variant="ghost" size="icon-sm" onPress={() => setEditingTask(task)}><Pencil /></Button><Link aria-label={`Open ${task.title}`} to={`/applications/${task.clientId}/${task.applicationId}`}><ArrowRight /></Link></div>
            </div>;
          })}
        </div>
      )}
      <TaskEditDialog task={editingTask} members={members} canAssign={admin} onOpenChange={(open) => !open && setEditingTask(null)} onSaved={async () => {}} />
    </div>
  );
}
