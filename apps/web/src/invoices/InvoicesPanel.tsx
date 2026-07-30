import { useEffect, useMemo, useState } from "react";
import {
  createInvoice, subscribeInvoicesByClient, updateInvoiceStatus,
  type Invoice, type InvoiceStatus,
} from "@solvingclub/core";
import { db } from "../db";
import { fb } from "../firebase";
import { InvoiceForm } from "./InvoiceForm";
import { StatusTag, StatusSelect, type StatusTone } from "../ui/StatusTag";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CircleAlert, Eye, Plus, ReceiptText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "overdue", "void"];
const STATUS_TONE: Record<InvoiceStatus, StatusTone> = {
  draft: "neutral", sent: "progress", paid: "done", overdue: "blocked", void: "neutral",
};

function money(currency: string, amount: number) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

function moneyTotals(invoices: Invoice[], include: (invoice: Invoice) => boolean) {
  const totals = new Map<string, number>();
  for (const invoice of invoices) {
    if (!include(invoice)) continue;
    totals.set(invoice.currency, (totals.get(invoice.currency) ?? 0) + invoice.total);
  }
  return [...totals.entries()].map(([currency, amount]) => money(currency, amount));
}

export function InvoicesPanel({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    return subscribeInvoicesByClient(db, clientId, (items) => {
      setInvoices(items); setLoadError(false); setLoading(false);
    }, () => { setLoadError(true); setLoading(false); });
  }, [clientId]);

  const summary = useMemo(() => ({
    outstanding: moneyTotals(invoices, (item) => item.status === "sent" || item.status === "overdue"),
    paid: moneyTotals(invoices, (item) => item.status === "paid"),
    draft: moneyTotals(invoices, (item) => item.status === "draft"),
    overdue: invoices.filter((item) => item.status === "overdue" || (item.status !== "paid" && item.status !== "void" && item.dueDate && item.dueDate < Date.now())).length,
  }), [invoices]);

  async function changeStatus(invoiceId: string, status: InvoiceStatus) {
    try {
      await updateInvoiceStatus(db, invoiceId, status);
      setActionError(null);
    } catch {
      setActionError("This invoice status change could not be saved. Please try again.");
    }
  }

  return (
    <div className="invoice-panel">
      <div className="invoice-toolbar"><div><ReceiptText /><span>{invoices.length} invoice{invoices.length === 1 ? "" : "s"}</span></div>{canEdit && <Button variant="outline" size="sm" onPress={() => setShowForm((value) => !value)}><Plus /> {showForm ? "Close form" : "New invoice"}</Button>}</div>
      {loadError && <div className="data-error" role="alert"><CircleAlert /> Invoices could not be loaded. Refresh to try again.</div>}
      {actionError && <div className="data-error" role="alert"><CircleAlert /> {actionError}</div>}
      {!loading && invoices.length > 0 && <section className="invoice-summary" aria-label="Billing summary">
        <div><span>Outstanding</span><strong>{summary.outstanding.join(" · ") || "—"}</strong></div>
        <div><span>Paid</span><strong>{summary.paid.join(" · ") || "—"}</strong></div>
        <div><span>Draft</span><strong>{summary.draft.join(" · ") || "—"}</strong></div>
        <div className={summary.overdue ? "risk" : ""}><span>Overdue</span><strong>{summary.overdue}</strong></div>
      </section>}
      {canEdit && showForm && (
        <InvoiceForm onSubmit={async (values) => {
          await createInvoice(db, {
            clientId, createdBy: fb.auth.currentUser?.uid ?? "unknown", lineItems: values.lineItems,
            currency: values.currency,
            ...(values.dueDate ? { dueDate: values.dueDate } : {}),
            ...(values.notes ? { notes: values.notes } : {}),
          });
          setShowForm(false);
        }} />
      )}

      {loading ? <div className="invoice-loading">{[1,2,3].map((item) => <Skeleton key={item} className="h-12 w-full" />)}</div> : invoices.length === 0 ? (
        <div className="invoice-empty-visual"><img src="/visuals/billing-ledger.jpg" alt="Abstract billing ledger system" loading="lazy" /><span><strong>No invoices yet</strong><small>{canEdit ? "Create one when work is ready to bill." : "Billing records will appear here when issued."}</small></span></div>
      ) : (
        <div className="invoice-list">
          {invoices.map((invoice) => {
              const overdue = invoice.status !== "paid" && invoice.status !== "void" && Boolean(invoice.dueDate && invoice.dueDate < Date.now());
              return <article key={invoice.id} className={`invoice-row${overdue ? " invoice-overdue" : ""}`}>
                <div className="invoice-row-primary"><button type="button" className="invoice-number" onClick={() => setSelected(invoice)}>{invoice.number}</button><span>Issued {new Date(invoice.issueDate).toLocaleDateString()}</span></div>
                <div className="invoice-row-status">{canEdit ? <StatusSelect value={invoice.status} tone={STATUS_TONE[invoice.status]} options={STATUSES} onChange={(status) => changeStatus(invoice.id, status)} /> : <StatusTag tone={STATUS_TONE[invoice.status]}>{invoice.status}</StatusTag>}</div>
                <div className="invoice-row-total"><strong>{money(invoice.currency, invoice.total)}</strong><span className={overdue ? "invoice-due-over" : ""}>{invoice.dueDate ? `Due ${new Date(invoice.dueDate).toLocaleDateString()}` : "Due on receipt"}</span></div>
                <Button aria-label={`View ${invoice.number}`} variant="ghost" size="icon-sm" onPress={() => setSelected(invoice)}><Eye /></Button>
              </article>;
            })}
        </div>
      )}

      <Dialog isOpen={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && <><DialogHeader><DialogTitle>{selected.number}</DialogTitle><DialogDescription>Issued {new Date(selected.issueDate).toLocaleDateString()} · {selected.lineItems.length} line item{selected.lineItems.length === 1 ? "" : "s"}</DialogDescription></DialogHeader>
          <div className="invoice-detail">
            <div className="invoice-detail-meta"><StatusTag tone={STATUS_TONE[selected.status]}>{selected.status}</StatusTag><span>Due {selected.dueDate ? new Date(selected.dueDate).toLocaleDateString() : "on receipt"}</span></div>
            <div className="invoice-lines">{selected.lineItems.map((item, index) => <div key={`${item.description}-${index}`}><span><strong>{item.description}</strong><small>{item.quantity} × {money(selected.currency, item.unitPrice)}</small></span><b>{money(selected.currency, item.quantity * item.unitPrice)}</b></div>)}</div>
            <div className="invoice-detail-total"><span>Total</span><strong>{money(selected.currency, selected.total)}</strong></div>
            {selected.notes && <div className="invoice-notes"><span>Notes</span><p>{selected.notes}</p></div>}
          </div>
          <DialogFooter showCloseButton />
        </>}
      </Dialog>
    </div>
  );
}
