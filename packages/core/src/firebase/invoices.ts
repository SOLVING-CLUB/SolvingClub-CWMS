import {
  collection, addDoc, getDocs, getDoc, doc, onSnapshot, query, where, updateDoc,
  runTransaction, type Firestore, type Unsubscribe,
} from "firebase/firestore";
import {
  parseInvoice, computeInvoiceTotal, lineItemSchema, invoiceStatusSchema, type Invoice, type LineItem, type InvoiceStatus,
} from "../models/invoice";
import { z } from "zod";

/** Atomically allocates the next sequential invoice number, e.g. "INV-0007". */
async function nextInvoiceNumber(db: Firestore): Promise<string> {
  const counterRef = doc(db, "counters", "invoiceSeq");
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? (snap.data().value as number) : 0;
    const next = current + 1;
    tx.set(counterRef, { value: next });
    return next;
  });
  return `INV-${String(seq).padStart(4, "0")}`;
}

export async function createInvoice(
  db: Firestore,
  input: {
    clientId: string; lineItems: LineItem[]; currency?: string;
    dueDate?: number; notes?: string; createdBy: string;
  },
): Promise<Invoice> {
  const lineItems = lineItemSchema.array().min(1).max(100).parse(input.lineItems);
  const notes = input.notes === undefined ? undefined : z.string().trim().max(1000).parse(input.notes);
  const number = await nextInvoiceNumber(db);
  const total = computeInvoiceTotal(lineItems);
  const issueDate = Date.now();
  const createdAt = issueDate;
  const status = "draft" as const;
  const currency = input.currency ?? "USD";

  const ref = await addDoc(collection(db, "invoices"), {
    clientId: input.clientId, number, status, lineItems, currency, total,
    issueDate, createdBy: input.createdBy, createdAt,
    ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
    ...(notes !== undefined && { notes }),
  });
  return parseInvoice({
    id: ref.id, clientId: input.clientId, number, status, lineItems,
    currency, total, issueDate, createdBy: input.createdBy, createdAt,
    dueDate: input.dueDate, notes,
  });
}

export async function listInvoicesByClient(db: Firestore, clientId: string): Promise<Invoice[]> {
  const snap = await getDocs(query(collection(db, "invoices"), where("clientId", "==", clientId)));
  return snap.docs
    .map((d) => parseInvoice({ id: d.id, ...d.data() }))
    .sort((a, b) => b.issueDate - a.issueDate);
}

/** Streams a client's billing records so totals and statuses stay current. */
export function subscribeInvoicesByClient(
  db: Firestore, clientId: string, onData: (invoices: Invoice[]) => void, onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "invoices"), where("clientId", "==", clientId)),
    (snapshot) => onData(snapshot.docs
      .map((item) => parseInvoice({ id: item.id, ...item.data() }))
      .sort((a, b) => b.issueDate - a.issueDate)),
    (error) => onError?.(error),
  );
}

export async function getInvoice(db: Firestore, id: string): Promise<Invoice | null> {
  const snap = await getDoc(doc(db, "invoices", id));
  return snap.exists() ? parseInvoice({ id: snap.id, ...snap.data() }) : null;
}

export async function updateInvoiceStatus(db: Firestore, id: string, status: InvoiceStatus): Promise<void> {
  await updateDoc(doc(db, "invoices", id), { status: invoiceStatusSchema.parse(status) });
}
