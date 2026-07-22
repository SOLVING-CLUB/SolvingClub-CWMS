import { useId, useState } from "react";
import { type LineItem } from "@solvingclub/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Plus, ReceiptText, Trash2 } from "lucide-react";

export type InvoiceFormValues = { lineItems: LineItem[]; currency: string; dueDate?: number; notes?: string };
const emptyRow: LineItem = { description: "", quantity: 1, unitPrice: 0 };
const CURRENCIES = ["USD", "INR", "EUR", "GBP", "AUD", "CAD"] as const;

function currencySymbol(currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(0).find((part) => part.type === "currency")?.value ?? currency;
  } catch { return currency; }
}

export function InvoiceForm({ onSubmit }: { onSubmit: (v: InvoiceFormValues) => Promise<void> }) {
  const fieldId = useId();
  const [rows, setRows] = useState<LineItem[]>([{ ...emptyRow }]);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(index: number, patch: Partial<LineItem>) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  const lineItems = rows.filter((row) => row.description.trim() && row.quantity > 0 && row.unitPrice >= 0);
  const total = lineItems.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0);
  const valid = lineItems.length > 0 && rows.every((row) => row.quantity > 0 && row.unitPrice >= 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) { setError("Add at least one complete line item with a quantity greater than zero."); return; }
    setBusy(true); setError(null);
    try {
      await onSubmit({ lineItems, currency, ...(dueDate ? { dueDate: new Date(`${dueDate}T12:00:00`).getTime() } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}) });
      setRows([{ ...emptyRow }]); setDueDate(""); setNotes(""); setCurrency("USD");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The invoice could not be created.");
    } finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="invoice-create-card">
    <header className="invoice-create-header"><span><ReceiptText /> New invoice</span><small>Draft · {currency}</small></header>
    <div className="invoice-line-editor">
      <div className="invoice-line-head"><span>Description</span><span>Quantity</span><span>Unit price</span><span className="sr-only">Remove</span></div>
      {rows.map((row, index) => <div key={index} className="invoice-line-row">
        <Input aria-label={`Line item ${index + 1} description`} placeholder="Service or deliverable" value={row.description} maxLength={160} onChange={(e) => updateRow(index, { description: e.target.value })} />
        <Input aria-label={`Line item ${index + 1} quantity`} type="number" min={0.01} step="any" value={row.quantity} className="font-mono" onChange={(e) => updateRow(index, { quantity: Number(e.target.value) })} />
        <div className="invoice-money-input"><span>{currencySymbol(currency)}</span><Input aria-label={`Line item ${index + 1} unit price`} type="number" min={0} step="0.01" value={row.unitPrice} className="font-mono" onChange={(e) => updateRow(index, { unitPrice: Number(e.target.value) })} /></div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove line item ${index + 1}`} isDisabled={rows.length === 1} onPress={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}><Trash2 /></Button>
      </div>)}
      <Button type="button" variant="ghost" size="sm" className="invoice-add-line" onPress={() => setRows((current) => [...current, { ...emptyRow }])}><Plus /> Add line item</Button>
    </div>
    <div className="invoice-create-meta">
      <div><Label htmlFor={`${fieldId}-currency`}>Currency</Label><NativeSelect id={`${fieldId}-currency`} value={currency} onChange={(event) => setCurrency(event.target.value)}>{CURRENCIES.map((item) => <NativeSelectOption key={item} value={item}>{item} — {currencySymbol(item)}</NativeSelectOption>)}</NativeSelect></div>
      <div><Label htmlFor={`${fieldId}-due`}>Due date</Label><Input id={`${fieldId}-due`} type="date" value={dueDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDueDate(e.target.value)} /></div>
      <div><Label htmlFor={`${fieldId}-notes`}>Client note <span>Optional</span></Label><Textarea id={`${fieldId}-notes`} placeholder="Payment terms or context shown with this invoice" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} /></div>
    </div>
    {error && <p role="alert" className="form-error">{error}</p>}
    <footer className="invoice-create-footer"><div><span>Invoice total</span><strong>{new Intl.NumberFormat(undefined, { style: "currency", currency }).format(total)}</strong></div><Button type="submit" isDisabled={busy || !valid}>{busy ? "Creating draft…" : "Create draft invoice"}</Button></footer>
  </form>;
}
