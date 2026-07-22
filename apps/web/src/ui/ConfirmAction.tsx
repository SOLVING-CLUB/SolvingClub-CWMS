import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function ConfirmAction({ title, description, trigger, confirmLabel = "Delete", onConfirm }: {
  title: string; description: string; trigger: ReactNode; confirmLabel?: string; onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true); setError(null);
    try { await onConfirm(); setOpen(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The action could not be completed."); }
    finally { setBusy(false); }
  }

  return <DialogTrigger isOpen={open} onOpenChange={setOpen}>
    {trigger}
    <Dialog>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      {error && <p className="form-error">{error}</p>}
      <DialogFooter showCloseButton><Button variant="destructive" isDisabled={busy} onPress={confirm}>{busy ? "Working…" : confirmLabel}</Button></DialogFooter>
    </Dialog>
  </DialogTrigger>;
}
