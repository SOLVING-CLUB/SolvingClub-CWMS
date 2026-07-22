import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  subscribeApplicationsByProject, createApplication, subscribeTasks, updateApplication, type Application, type Task,
} from "@solvingclub/core";
import { db } from "../db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Boxes, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmAction } from "../ui/ConfirmAction";
import { deleteApplicationTree } from "../functions";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export function ProjectApplications({ projectId, clientId, canEdit }: { projectId: string; clientId: string; canEdit: boolean }) {
  const [apps, setApps] = useState<Application[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Application | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "archived">("active");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    let appsReady = false; let tasksReady = false;
    setLoading(true);
    const ready = () => { if (appsReady && tasksReady) { setLoading(false); setError(null); } };
    const failed = () => { setLoading(false); setError("Applications could not be loaded. Refresh to try again."); };
    const stopApps = subscribeApplicationsByProject(db, projectId, clientId, (items) => { setApps(items); appsReady = true; ready(); }, failed);
    const stopTasks = subscribeTasks(db, { projectId, clientId }, (items) => { setTasks(items); tasksReady = true; ready(); }, failed);
    return () => { stopApps(); stopTasks(); };
  }, [projectId, clientId]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setError(null);
    try {
      await createApplication(db, { projectId, clientId, name: name.trim() });
      setName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The application could not be created.");
    } finally { setBusy(false); }
  }

  function openEditor(application: Application) {
    setEditing(application); setEditName(application.name); setEditType(application.type ?? "");
    setEditDescription(application.description ?? ""); setEditStatus(application.status); setEditError(null);
  }

  async function saveApplication() {
    if (!editing || !editName.trim()) return;
    setSaving(true); setEditError(null);
    try {
      await updateApplication(db, editing.id, {
        name: editName, type: editType.trim() || null, description: editDescription.trim() || null, status: editStatus,
      });
      setEditing(null);
    } catch (cause) {
      setEditError(cause instanceof Error ? cause.message : "The application could not be saved.");
    } finally { setSaving(false); }
  }

  return (
    <div className="application-stack">
      <div className="application-stack-heading"><span><Boxes /> Applications</span><small>{apps.length} total</small></div>
      {canEdit && <form onSubmit={onAdd} className="application-create">
        <Input aria-label="Application name" placeholder="Add an application or workstream…" value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
        <Button type="submit" variant="secondary" isDisabled={busy}>{busy ? "Adding…" : <><Plus /> Add application</>}</Button>
      </form>}
      {error && <p role="alert" className="form-error">{error}</p>}
      {loading ? <div className="application-loading"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : <div className="application-list">{apps.map((a) => {
        const appTasks = tasks.filter((task) => task.applicationId === a.id);
        const completed = appTasks.filter((task) => task.status === "done").length;
        const progress = appTasks.length ? Math.round((completed / appTasks.length) * 100) : 0;
        return (
        <div key={a.id} className="application-row">
          <Link to={`/applications/${clientId}/${a.id}`}>
            <span className="application-icon"><Boxes /></span>
            <span className="application-copy"><strong>{a.name}</strong><small>{appTasks.length ? `${completed} of ${appTasks.length} tasks complete` : "No tasks yet"}</small></span>
            <span className="application-progress" aria-label={`${progress}% complete`}><i style={{ width: `${progress}%` }} /></span>
            <ArrowRight />
          </Link>
          {canEdit && <div className="application-row-actions"><Button aria-label={`Edit ${a.name}`} variant="ghost" size="icon-sm" onPress={() => openEditor(a)}><Pencil /></Button><ConfirmAction title={`Delete ${a.name}?`} description="This permanently removes the application, its tasks, comments, and document records." trigger={<Button aria-label={`Delete ${a.name}`} variant="ghost" size="icon-sm" className="text-destructive"><Trash2 /></Button>} onConfirm={async () => { await deleteApplicationTree({ id: a.id }); }} /></div>}
        </div>
      );})}</div>}
      {!loading && !apps.length && !error && <div className="application-empty"><CheckCircle2 /> No applications in this project yet.</div>}
      <Dialog isOpen={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogHeader><DialogTitle>Edit application</DialogTitle><DialogDescription>Keep the workstream’s delivery context accurate for your team and client.</DialogDescription></DialogHeader>
        <div className="dialog-form application-edit-form">
          <div><Label htmlFor="application-name">Name</Label><Input id="application-name" autoFocus value={editName} maxLength={160} onChange={(event) => setEditName(event.target.value)} /></div>
          <div><Label htmlFor="application-type">Type <span>Optional</span></Label><Input id="application-type" placeholder="Website, API, campaign…" value={editType} maxLength={80} onChange={(event) => setEditType(event.target.value)} /></div>
          <div><Label htmlFor="application-status">Status</Label><NativeSelect id="application-status" value={editStatus} onChange={(event) => setEditStatus(event.target.value as "active" | "archived")}><NativeSelectOption value="active">Active</NativeSelectOption><NativeSelectOption value="archived">Archived</NativeSelectOption></NativeSelect></div>
          <div><Label htmlFor="application-description">Description <span>Optional</span></Label><Textarea id="application-description" placeholder="Brief scope, goals, or delivery notes…" value={editDescription} maxLength={4000} onChange={(event) => setEditDescription(event.target.value)} /></div>
          {editError && <p className="form-error" role="alert">{editError}</p>}
        </div>
        <DialogFooter showCloseButton><Button isDisabled={saving || !editName.trim()} onPress={saveApplication}>{saving ? "Saving…" : "Save changes"}</Button></DialogFooter>
      </Dialog>
    </div>
  );
}
