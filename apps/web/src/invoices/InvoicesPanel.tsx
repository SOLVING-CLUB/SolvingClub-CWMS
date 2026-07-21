import { useEffect, useState } from "react";
import {
  createInvoice, listInvoicesByClient, updateInvoiceStatus,
  type Invoice, type InvoiceStatus,
} from "@solvingclub/core";
import { db } from "../db";
import { fb } from "../firebase";
import { InvoiceForm } from "./InvoiceForm";

const STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "overdue", "void"];

export function InvoicesPanel({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  async function refresh() { setInvoices(await listInvoicesByClient(db, clientId)); }
  useEffect(() => { refresh(); }, [clientId]);

  return (
    <div style={{ marginBottom: 16 }}>
      <h2>Invoices</h2>
      {canEdit && (
        <InvoiceForm onSubmit={async (v) => {
          await createInvoice(db, {
            clientId, createdBy: fb.auth.currentUser?.uid ?? "unknown", lineItems: v.lineItems,
            ...(v.dueDate ? { dueDate: v.dueDate } : {}),
            ...(v.notes ? { notes: v.notes } : {}),
          });
          await refresh();
        }} />
      )}
      <table width="100%">
        <thead>
          <tr><th align="left">Number</th><th>Status</th><th>Total</th><th>Issued</th><th>Due</th></tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td>{inv.number}</td>
              <td>
                {canEdit ? (
                  <select value={inv.status}
                    onChange={async (e) => { await updateInvoiceStatus(db, inv.id, e.target.value as InvoiceStatus); await refresh(); }}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : inv.status}
              </td>
              <td>{inv.currency} {inv.total.toFixed(2)}</td>
              <td>{new Date(inv.issueDate).toLocaleDateString()}</td>
              <td>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</td>
            </tr>
          ))}
          {invoices.length === 0 && <tr><td colSpan={5}>No invoices yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
