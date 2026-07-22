import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { subscribeClients, subscribeTasks, type Client, type Task } from "@solvingclub/core";
import {
  ArrowRight, Building2, CalendarClock, CheckCircle2, CircleAlert, Plus, Sparkles,
} from "lucide-react";
import { db } from "../db";
import { PageHeader } from "../ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge } from "../ui/PrioritySelect";
import { StatusTag, type StatusTone } from "../ui/StatusTag";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_TONE: Record<Task["status"], StatusTone> = {
  todo: "neutral", in_progress: "progress", blocked: "blocked", done: "done",
};

function dueLabel(dueDate?: number) {
  if (!dueDate) return "No due date";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 7) return `Due in ${days}d`;
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function OverviewPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let clientsReady = false; let tasksReady = false;
    const ready = () => { if (clientsReady && tasksReady) { setLoading(false); setError(false); } };
    const failed = () => { setLoading(false); setError(true); };
    const stopClients = subscribeClients(db, (nextClients) => { setClients(nextClients); clientsReady = true; ready(); }, failed);
    const stopTasks = subscribeTasks(db, {}, (nextTasks) => { setTasks(nextTasks); tasksReady = true; ready(); }, failed);
    return () => { stopClients(); stopTasks(); };
  }, []);

  const data = useMemo(() => {
    const now = Date.now();
    const open = tasks.filter((task) => task.status !== "done");
    const completed = tasks.filter((task) => task.status === "done").length;
    const overdue = open.filter((task) => task.dueDate && task.dueDate < now).length;
    const dueSoon = open.filter((task) => task.dueDate && task.dueDate >= now && task.dueDate <= now + 7 * 86_400_000).length;
    const blocked = open.filter((task) => task.status === "blocked").length;
    const completion = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
    const clientMap = new Map(clients.map((client) => [client.id, client]));
    const focus = [...open]
      .sort((a, b) => Number(Boolean(b.dueDate && b.dueDate < now)) - Number(Boolean(a.dueDate && a.dueDate < now))
        || a.priority - b.priority || (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity))
      .slice(0, 7);
    return { open, completed, overdue, dueSoon, blocked, completion, clientMap, focus };
  }, [clients, tasks]);

  return (
    <div className="content-stack overview-page">
      <PageHeader eyebrow={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        title="Delivery overview" description="What needs attention across every client, in one place."
        actions={<><Button variant="outline" onPress={() => navigate("/work")}>View all work</Button><Button onPress={() => navigate("/clients?new=1")}><Plus /> New client</Button></>} />

      {error && <div className="data-error" role="alert"><CircleAlert /> Workspace data could not be loaded. Refresh the page to try again.</div>}

      <section className="delivery-brief" aria-label="Delivery pulse">
        <img className="delivery-brief-art" src="/visuals/delivery-routing.jpg" alt="" aria-hidden="true" />
        <div className="delivery-brief-copy">
          <span className="signal-kicker"><Sparkles /> Delivery pulse</span>
          <strong>{data.blocked || data.overdue ? `${data.blocked + data.overdue} items need attention` : "Delivery is moving cleanly"}</strong>
          <p>{data.open.length} open tasks across {clients.length} client{clients.length === 1 ? "" : "s"}. {data.dueSoon ? `${data.dueSoon} due in the next seven days.` : "No deadlines in the next seven days."}</p>
        </div>
        <div className="delivery-score" aria-label={`${data.completion}% of all tasks completed`}>
          <span><b>{data.completion}%</b> complete</span>
          <div><i style={{ width: `${data.completion}%` }} /></div>
        </div>
      </section>

      <section className="pulse-grid" aria-label="Workspace status">
        <div className="pulse-card"><span>Active clients</span>{loading ? <Skeleton className="h-8 w-12" /> : <strong>{clients.length}</strong>}<Building2 /><small>In the workspace</small></div>
        <div className="pulse-card"><span>Open work</span>{loading ? <Skeleton className="h-8 w-12" /> : <strong>{data.open.length}</strong>}<CalendarClock /><small>{data.dueSoon} due soon</small></div>
        <div className="pulse-card risk"><span>At risk</span>{loading ? <Skeleton className="h-8 w-12" /> : <strong>{data.blocked + data.overdue}</strong>}<CircleAlert /><small>{data.blocked} blocked · {data.overdue} overdue</small></div>
        <div className="pulse-card"><span>Completed</span>{loading ? <Skeleton className="h-8 w-12" /> : <strong>{data.completed}</strong>}<CheckCircle2 /><small>All-time tasks</small></div>
      </section>

      <div className="overview-grid">
        <Card className="focus-card">
          <CardHeader className="border-b"><div><CardTitle>Attention queue</CardTitle><p>Ordered by risk, priority, then deadline.</p></div><Badge variant="secondary">{data.focus.length} shown</Badge></CardHeader>
          <CardContent className="p-0">
            {loading ? <div className="overview-loading">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-12 w-full" />)}</div> : data.focus.length === 0 ? <div className="quiet-empty">No open work. The queue is clear.</div> : data.focus.map((task) => (
              <Link className="work-row actionable" key={task.id} to={`/clients/${task.clientId}/apps/${task.applicationId}`}>
                <StatusTag tone={STATUS_TONE[task.status]}>{task.status.replace("_", " ")}</StatusTag>
                <div><strong>{task.title}</strong><small>{data.clientMap.get(task.clientId)?.name ?? "Client"}</small></div>
                <PriorityBadge value={task.priority} />
                <time className={task.dueDate && task.dueDate < Date.now() ? "overdue" : ""}>{dueLabel(task.dueDate)}</time>
                <ArrowRight className="row-arrow" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b"><div><CardTitle>Client load</CardTitle><p>Open delivery work by relationship.</p></div><Link to="/clients" className="inline-link">View all <ArrowRight /></Link></CardHeader>
          <CardContent className="p-0">
            {loading ? <div className="overview-loading">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-12 w-full" />)}</div> : clients.slice(-6).reverse().map((client) => {
              const openCount = data.open.filter((task) => task.clientId === client.id).length;
              return (
                <Link className="client-row" to={`/clients/${client.id}`} key={client.id}>
                  <span className="client-avatar">{client.name.slice(0, 2).toUpperCase()}</span>
                  <div><strong>{client.name}</strong><small>{openCount ? `${openCount} open task${openCount === 1 ? "" : "s"}` : "No open work"}</small></div>
                  <span className="client-load-count">{openCount}</span><ArrowRight />
                </Link>
              );
            })}
            {!loading && clients.length === 0 && <div className="quiet-empty">No clients yet. Create one to start tracking delivery.</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
