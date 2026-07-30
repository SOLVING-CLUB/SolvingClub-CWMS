import { useState } from "react";
import { createProject, PROJECT_TYPE_LABELS, type Client, type Project, type ProjectType } from "@solvingclub/core";
import { X } from "lucide-react";
import { db } from "../db";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

const PROJECT_TYPE_ORDER: ProjectType[] = [
  "web_app", "mobile_app", "desktop_app", "website",
  "api_service", "ai_ml", "data_platform", "automation", "other",
];

/** Comma or Enter both commit a tech-stack entry, deduplicated, order preserved. */
function addStackEntries(current: string[], raw: string): string[] {
  const additions = raw.split(",").map((entry) => entry.trim()).filter(Boolean);
  const next = [...current];
  for (const addition of additions) {
    if (next.length >= 24) break;
    if (!next.some((entry) => entry.toLowerCase() === addition.toLowerCase())) next.push(addition.slice(0, 40));
  }
  return next;
}

/** Local date input value ("YYYY-MM-DD") → a UTC-midnight timestamp. */
function dateInputToTimestamp(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(parsed) ? undefined : parsed;
}

type NewProjectDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fixed client (client workspace), or omit to let the user choose. */
  clientId?: string;
  clients?: Client[];
  onCreated?: (project: Project) => void;
};

export function NewProjectDialog({ isOpen, onOpenChange, clientId, clients, onCreated }: NewProjectDialogProps) {
  const [selectedClientId, setSelectedClientId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<ProjectType | "">("");
  const [startDate, setStartDate] = useState("");
  const [techStack, setTechStack] = useState<string[]>([]);
  const [stackDraft, setStackDraft] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveClientId = clientId ?? selectedClientId;

  function reset() {
    setSelectedClientId(""); setName(""); setType(""); setStartDate("");
    setTechStack([]); setStackDraft(""); setDescription(""); setError(null);
  }

  function close(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  function commitStackDraft() {
    if (!stackDraft.trim()) return;
    setTechStack((current) => addStackEntries(current, stackDraft));
    setStackDraft("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    // A stack name still sitting in the input should not be lost on submit.
    const stack = stackDraft.trim() ? addStackEntries(techStack, stackDraft) : techStack;
    if (!effectiveClientId || !name.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const project = await createProject(db, {
        clientId: effectiveClientId,
        name: name.trim(),
        ...(type ? { type } : {}),
        ...(dateInputToTimestamp(startDate) !== undefined && { startDate: dateInputToTimestamp(startDate) }),
        ...(stack.length ? { techStack: stack } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      onCreated?.(project);
      reset();
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The project could not be created.");
    } finally { setBusy(false); }
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={close}>
      <DialogHeader>
        <DialogTitle>New project</DialogTitle>
        <DialogDescription>Capture what is being built, on what stack, and when it starts.</DialogDescription>
      </DialogHeader>
      <form id="new-project-form" className="dialog-form" onSubmit={submit}>
        {!clientId && (
          <div>
            <Label htmlFor="new-project-client">Client</Label>
            <NativeSelect id="new-project-client" value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
              <NativeSelectOption value="">Choose a client</NativeSelectOption>
              {(clients ?? []).map((client) => <NativeSelectOption key={client.id} value={client.id}>{client.name}</NativeSelectOption>)}
            </NativeSelect>
          </div>
        )}
        <div>
          <Label htmlFor="new-project-name">Project name</Label>
          <Input id="new-project-name" autoFocus placeholder="Website redesign" value={name} maxLength={160} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="field-row">
          <div>
            <Label htmlFor="new-project-type">Project type</Label>
            <NativeSelect id="new-project-type" value={type} onChange={(event) => setType(event.target.value as ProjectType | "")}>
              <NativeSelectOption value="">Not specified</NativeSelectOption>
              {PROJECT_TYPE_ORDER.map((option) => <NativeSelectOption key={option} value={option}>{PROJECT_TYPE_LABELS[option]}</NativeSelectOption>)}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="new-project-start">Start date <span>Optional</span></Label>
            <Input id="new-project-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="new-project-stack">Tech stack <span>Optional</span></Label>
          <Input
            id="new-project-stack"
            placeholder="React, Node, Postgres — press Enter to add"
            value={stackDraft}
            maxLength={40}
            onChange={(event) => {
              // A typed comma means the entry is finished.
              if (event.target.value.includes(",")) { setTechStack((current) => addStackEntries(current, event.target.value)); setStackDraft(""); return; }
              setStackDraft(event.target.value);
            }}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitStackDraft(); } }}
            onBlur={commitStackDraft}
          />
          {techStack.length > 0 && <div className="stack-tags">
            {techStack.map((entry) => <span className="stack-tag" key={entry}>
              {entry}
              <button type="button" aria-label={`Remove ${entry}`} onClick={() => setTechStack((current) => current.filter((item) => item !== entry))}><X /></button>
            </span>)}
          </div>}
          <small>{techStack.length}/24 technologies</small>
        </div>
        <div>
          <Label htmlFor="new-project-description">Delivery brief <span>Optional</span></Label>
          <Textarea id="new-project-description" placeholder="What outcome should this project deliver?" value={description} maxLength={4000} onChange={(event) => setDescription(event.target.value)} />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
      <DialogFooter showCloseButton>
        <Button type="submit" form="new-project-form" isDisabled={busy || !effectiveClientId || !name.trim()}>
          {busy ? "Creating…" : "Create project"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
