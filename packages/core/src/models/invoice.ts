import { z } from "zod";

export const invoiceStatusSchema = z.enum(["draft", "sent", "paid", "overdue", "void"]);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

export const lineItemSchema = z.object({
  description: z.string().trim().min(1).max(160),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});
export type LineItem = z.infer<typeof lineItemSchema>;

export const invoiceSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  number: z.string().min(1),
  status: invoiceStatusSchema,
  lineItems: z.array(lineItemSchema).min(1),
  currency: z.string().min(1).default("USD"),
  total: z.number().nonnegative(),
  issueDate: z.number(),
  dueDate: z.number().optional(),
  notes: z.string().trim().max(1000).optional(),
  createdBy: z.string().min(1),
  createdAt: z.number(),
});

export type Invoice = z.infer<typeof invoiceSchema>;

export function parseInvoice(input: unknown): Invoice {
  return invoiceSchema.parse(input);
}

export function computeInvoiceTotal(lineItems: LineItem[]): number {
  return lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
}
