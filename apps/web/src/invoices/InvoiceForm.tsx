import { useState } from "react";
import { type LineItem } from "@solvingclub/core";

export type InvoiceFormValues = { lineItems: LineItem[]; dueDate?: number; notes?: string };

const emptyRow: LineItem = { description: "", quantity: 1, unitPrice: 0 };

export function InvoiceForm({ onSubmit }: { onSubmit: (v: InvoiceFormValues) => Promise<void> }) {
  const [rows, setRows] = useState<LineItem[]>([{ ...emptyRow }]);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  function updateRow(i: number, patch: Partial<LineItem>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const lineItems = rows.filter((r) => r.description.trim() && r.quantity > 0);
    if (lineItems.length === 0) return;
    await onSubmit({
      lineItems,
      ...(dueDate ? { dueDate: new Date(dueDate).getTime() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
    setRows([{ ...emptyRow }]); setDueDate(""); setNotes("");
  }

  const total = rows.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0);

  return (
    <form onSubmit={submit} className="card">
      {rows.map((row, i) => (
        <div key={i} className="form-row" style={{ marginBottom: 6 }}>
          <input placeholder="Description" value={row.description}
            onChange={(e) => updateRow(i, { description: e.target.value })} style={{ flex: 1 }} />
          <input type="number" min={0} step="any" placeholder="Qty" value={row.quantity}
            className="mono" style={{ width: 64 }}
            onChange={(e) => updateRow(i, { quantity: Number(e.target.value) })} />
          <input type="number" min={0} step="any" placeholder="Unit price" value={row.unitPrice}
            className="mono" style={{ width: 90 }}
            onChange={(e) => updateRow(i, { unitPrice: Number(e.target.value) })} />
          <button type="button" onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}>Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => setRows((r) => [...r, { ...emptyRow }])}>+ Line item</button>

      <div className="form-row" style={{ marginTop: 12 }}>
        <label className="muted" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          Due <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ flex: 1 }} />
      </div>

      <div style={{
        display: "flex", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)",
      }}>
        <span className="mono" style={{ fontWeight: 600, fontSize: 15 }}>${total.toFixed(2)}</span>
        <span style={{ flex: 1 }} />
        <button type="submit">Create invoice</button>
      </div>
    </form>
  );
}
