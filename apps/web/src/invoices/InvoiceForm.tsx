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
    <form onSubmit={submit} style={{ border: "1px solid #eee", padding: 12, marginBottom: 16 }}>
      {rows.map((row, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
          <input placeholder="Description" value={row.description}
            onChange={(e) => updateRow(i, { description: e.target.value })} style={{ flex: 1 }} />
          <input type="number" min={0} step="any" placeholder="Qty" value={row.quantity} style={{ width: 70 }}
            onChange={(e) => updateRow(i, { quantity: Number(e.target.value) })} />
          <input type="number" min={0} step="any" placeholder="Unit price" value={row.unitPrice} style={{ width: 90 }}
            onChange={(e) => updateRow(i, { unitPrice: Number(e.target.value) })} />
          <button type="button" onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}>remove</button>
        </div>
      ))}
      <button type="button" onClick={() => setRows((r) => [...r, { ...emptyRow }])}>+ line item</button>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <label>Due <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
        <input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ flex: 1 }} />
      </div>
      <div style={{ marginTop: 8 }}>
        <strong>Total: ${total.toFixed(2)}</strong>{" "}
        <button type="submit">Create invoice</button>
      </div>
    </form>
  );
}
