import { useEffect, useState } from "react";
import {
  createInvoice, listInvoicesByClient, updateInvoiceStatus,
  type Invoice, type InvoiceStatus,
} from "@solvingclub/core";
import { db } from "../db";
import { fb } from "../firebase";
import { InvoiceForm } from "./InvoiceForm";
import { StatusTag, StatusSelect, type StatusTone } from "../ui/StatusTag";

const STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "overdue", "void"];
const STATUS_TONE: Record<InvoiceStatus, StatusTone> = {
  draft: "neutral", sent: "progress", paid: "done", overdue: "blocked", void: "neutral",
};

export function InvoicesPanel({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  async function refresh() { setInvoices(await listInvoicesByClient(db, clientId)); }
  useEffect(() => { refresh(); }, [clientId]);

  return (
    <div>
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

      {invoices.length === 0 ? (
        <p className="empty-state">No invoices yet.</p>
      ) : (
        <div className="card" style={{ padding: 0, marginBottom: 16 }}>
          <table>
            <thead>
              <tr>
                <th style={{ paddingLeft: 18 }}>Number</th><th>Status</th><th>Total</th>
                <th>Issued</th><th style={{ paddingRight: 18 }}>Due</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="mono" style={{ paddingLeft: 18, fontWeight: 500 }}>{inv.number}</td>
                  <td>
                    {canEdit ? (
                      <StatusSelect value={inv.status} tone={STATUS_TONE[inv.status]} options={STATUSES}
                        onChange={async (v) => { await updateInvoiceStatus(db, inv.id, v); await refresh(); }} />
                    ) : (
                      <StatusTag tone={STATUS_TONE[inv.status]}>{inv.status}</StatusTag>
                    )}
                  </td>
                  <td className="mono">{inv.currency} {inv.total.toFixed(2)}</td>
                  <td className="mono muted" style={{ fontSize: 12 }}>{new Date(inv.issueDate).toLocaleDateString()}</td>
                  <td className="mono muted" style={{ fontSize: 12, paddingRight: 18 }}>
                    {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
