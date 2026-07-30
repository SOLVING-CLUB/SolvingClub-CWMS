import { useEffect, useMemo, useState } from "react";
import { subscribeMembers, type Member } from "@solvingclub/core";
import { CircleAlert, Pencil, Plus, ShieldCheck, ShieldOff, UserCheck, Users } from "lucide-react";
import { db } from "../db";
import { createMemberUser, updateMemberUser } from "../functions";
import { useSession } from "../auth/SessionContext";
import { PageHeader } from "../ui/PageHeader";
import { EmptyState } from "../ui/EmptyState";
import { PasswordInput } from "../ui/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const ROLE_COPY = {
  owner: "Full workspace ownership",
  admin: "Manage clients and all delivery work",
  member: "Create work and update assigned tasks",
} as const;

export function MembersPage() {
  const session = useSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [role, setRole] = useState<"admin" | "member">("member");
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Member | null>(null);
  const [editRole, setEditRole] = useState<"admin" | "member">("member");
  const [editStatus, setEditStatus] = useState<"active" | "disabled">("active");
  const [editBusy, setEditBusy] = useState(false); const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => subscribeMembers(db, (nextMembers) => {
    setMembers(nextMembers); setLoading(false); setLoadError(false);
  }, () => { setLoading(false); setLoadError(true); }), []);

  const summary = useMemo(() => ({
    active: members.filter((member) => member.status === "active").length,
    admins: members.filter((member) => member.role === "owner" || member.role === "admin").length,
    disabled: members.filter((member) => member.status === "disabled").length,
  }), [members]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      await createMemberUser({ name: name.trim(), email: email.trim().toLocaleLowerCase(), password, role });
      setOpen(false); setName(""); setEmail(""); setPassword(""); setRole("member");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Member could not be created."); }
    finally { setBusy(false); }
  }

  function openEditor(member: Member) {
    if (member.role === "owner" || member.uid === session.uid) return;
    setEditing(member); setEditRole(member.role as "admin" | "member");
    setEditStatus(member.status === "disabled" ? "disabled" : "active"); setEditError(null);
  }

  async function saveMember() {
    if (!editing) return;
    setEditBusy(true); setEditError(null);
    try {
      await updateMemberUser({ uid: editing.uid, role: editRole, status: editStatus });
      setEditing(null);
    } catch (cause) { setEditError(cause instanceof Error ? cause.message : "Member access could not be updated."); }
    finally { setEditBusy(false); }
  }

  if (session.role !== "owner") return <EmptyState icon={<ShieldCheck />} title="Owner access required" description="Only workspace owners can manage team access." />;

  return <div className="content-stack members-page">
    <PageHeader eyebrow="Workspace" title="Members" description="Manage internal access and responsibilities." actions={<Button onPress={() => { setError(null); setOpen(true); }}><Plus /> Add member</Button>} />
    {loadError && <div className="data-error" role="alert"><CircleAlert /> Member access could not be loaded. Refresh the page to retry.</div>}

    <section className="member-summary" aria-label="Team access summary">
      <div><Users /><span>Team accounts</span><strong>{members.length}</strong></div>
      <div><UserCheck /><span>Active access</span><strong>{summary.active}</strong></div>
      <div><ShieldCheck /><span>Administrators</span><strong>{summary.admins}</strong></div>
      <div className={summary.disabled ? "risk" : ""}><ShieldOff /><span>Disabled</span><strong>{summary.disabled}</strong></div>
    </section>

    <section className="member-directory">
      <header><div><strong>Access directory</strong><small>Roles define what teammates can view and change.</small></div><span>{members.length} account{members.length === 1 ? "" : "s"}</span></header>
      {loading ? <div className="member-loading" role="status" aria-label="Loading members">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full" />)}</div> : members.map((member) => {
        const locked = member.role === "owner" || member.uid === session.uid;
        return <article className={`member-access-row${member.status === "disabled" ? " disabled" : ""}`} key={member.uid}>
          <span className="member-avatar">{member.name.slice(0, 2).toUpperCase()}</span>
          <div className="member-identity"><strong>{member.name}{member.uid === session.uid && <Badge variant="secondary">You</Badge>}</strong><small>{member.email}</small></div>
          <div className="member-role"><Badge variant={member.role === "owner" ? "default" : "outline"}>{member.role}</Badge><small>{ROLE_COPY[member.role]}</small></div>
          <span className={`member-access-status ${member.status}`}><i />{member.status === "disabled" ? "Disabled" : member.status === "invited" ? "Invited" : "Active"}</span>
          <Button variant="ghost" size="sm" isDisabled={locked} aria-label={locked ? `${member.name} access is protected` : `Manage ${member.name}`} onPress={() => openEditor(member)}><Pencil /> Manage</Button>
        </article>;
      })}
      {!loading && !members.length && <EmptyState icon={<Users />} title="No members" description="Add the first teammate to this workspace." />}
    </section>

    <Dialog isOpen={open} onOpenChange={setOpen}>
      <DialogHeader><DialogTitle>Add member</DialogTitle><DialogDescription>Create a secure internal account with the minimum access they need.</DialogDescription></DialogHeader>
      <form id="create-member" onSubmit={create} className="dialog-form">
        <div><Label htmlFor="member-name">Full name</Label><Input id="member-name" autoFocus maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label htmlFor="member-email">Email</Label><Input id="member-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><Label htmlFor="member-password">Temporary password</Label><PasswordInput id="member-password" autoComplete="new-password" minLength={8} maxLength={128} value={password} toggleDisabled={busy} onChange={(e) => setPassword(e.target.value)} /><small>Use at least 8 characters and share it securely.</small></div>
        <div><Label htmlFor="member-role">Initial role</Label><NativeSelect id="member-role" value={role} onChange={(e) => setRole(e.target.value as "admin" | "member")}><NativeSelectOption value="member">Member — assigned delivery work</NativeSelectOption><NativeSelectOption value="admin">Admin — all clients and delivery work</NativeSelectOption></NativeSelect></div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
      <DialogFooter showCloseButton><Button type="submit" form="create-member" isDisabled={busy || name.trim().length < 2 || !email.includes("@") || password.length < 8}>{busy ? "Creating secure account…" : "Create member"}</Button></DialogFooter>
    </Dialog>

    <Dialog isOpen={editing !== null} onOpenChange={(nextOpen) => !nextOpen && setEditing(null)}>
      {editing && <><DialogHeader><DialogTitle>Manage {editing.name}</DialogTitle><DialogDescription>Update workspace responsibility and authentication access together.</DialogDescription></DialogHeader>
        <div className="dialog-form">
          <div className="member-edit-identity"><span className="member-avatar">{editing.name.slice(0, 2).toUpperCase()}</span><div><strong>{editing.email}</strong><small>Changes take effect immediately.</small></div></div>
          <div><Label htmlFor="edit-member-role">Role</Label><NativeSelect id="edit-member-role" value={editRole} onChange={(event) => setEditRole(event.target.value as "admin" | "member")}><NativeSelectOption value="member">Member — assigned delivery work</NativeSelectOption><NativeSelectOption value="admin">Admin — all clients and delivery work</NativeSelectOption></NativeSelect></div>
          <div><Label htmlFor="edit-member-status">Access status</Label><NativeSelect id="edit-member-status" value={editStatus} onChange={(event) => setEditStatus(event.target.value as "active" | "disabled")}><NativeSelectOption value="active">Active — can sign in</NativeSelectOption><NativeSelectOption value="disabled">Disabled — sign-in blocked</NativeSelectOption></NativeSelect></div>
          {editStatus === "disabled" && <div className="member-access-warning"><ShieldOff /><span><strong>Authentication will be disabled</strong><small>The member’s records and task history remain intact.</small></span></div>}
          {editError && <p className="form-error" role="alert">{editError}</p>}
        </div>
        <DialogFooter showCloseButton><Button variant={editStatus === "disabled" ? "destructive" : "default"} isDisabled={editBusy || (editRole === editing.role && editStatus === editing.status)} onPress={saveMember}>{editBusy ? "Updating access…" : "Save access changes"}</Button></DialogFooter></>}
    </Dialog>
  </div>;
}
