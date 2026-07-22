import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestEnv, seedClient, seedMember, memberDb } from "./testEnv";
import { createInvoice, listInvoicesByClient, subscribeInvoicesByClient, updateInvoiceStatus, getInvoice } from "./invoices";

describe("invoice data-access (as member)", () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedMember("u1");
    await seedClient();
  });
  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it("computes the total and issues sequential invoice numbers", async () => {
    const db = await memberDb("u1");
    const first = await createInvoice(db, {
      clientId: "c1", createdBy: "u1",
      lineItems: [{ description: "Design", quantity: 2, unitPrice: 100 }],
    });
    expect(first.number).toBe("INV-0001");
    expect(first.total).toBe(200);
    expect(first.status).toBe("draft");

    const second = await createInvoice(db, {
      clientId: "c1", createdBy: "u1",
      lineItems: [{ description: "Dev", quantity: 1, unitPrice: 50 }],
    });
    expect(second.number).toBe("INV-0002");
  });

  it("lists by client, newest first, and updates status", async () => {
    const db = await memberDb("u1");
    const a = await createInvoice(db, {
      clientId: "c1", createdBy: "u1", lineItems: [{ description: "A", quantity: 1, unitPrice: 10 }],
    });
    const b = await createInvoice(db, {
      clientId: "c1", createdBy: "u1", lineItems: [{ description: "B", quantity: 1, unitPrice: 20 }],
    });

    const list = await listInvoicesByClient(db, "c1");
    expect(list.map((i) => i.id)).toEqual([b.id, a.id]);

    await updateInvoiceStatus(db, a.id, "paid");
    const updated = await getInvoice(db, a.id);
    expect(updated?.status).toBe("paid");
  });

  it("validates line items before allocating an invoice number", async () => {
    const db = await memberDb("u1");
    await expect(createInvoice(db, {
      clientId: "c1", createdBy: "u1",
      lineItems: [{ description: "Invalid", quantity: 0, unitPrice: 10 }],
    })).rejects.toThrow();
    const invoice = await createInvoice(db, {
      clientId: "c1", createdBy: "u1",
      lineItems: [{ description: "Valid", quantity: 1, unitPrice: 10 }],
    });
    expect(invoice.number).toBe("INV-0001");
  });

  it("keeps a client's invoices synchronized", async () => {
    const db = await memberDb("u1");
    const received = new Promise<string[]>((resolve, reject) => {
      let unsubscribe = () => {};
      const timeout = setTimeout(() => { unsubscribe(); reject(new Error("Invoice subscription timed out")); }, 5000);
      unsubscribe = subscribeInvoicesByClient(db, "c1", (items) => {
        if (!items.some((item) => item.number === "INV-0001")) return;
        clearTimeout(timeout); unsubscribe(); resolve(items.map((item) => item.number));
      }, reject);
    });
    await createInvoice(db, {
      clientId: "c1", createdBy: "u1", lineItems: [{ description: "Live billing", quantity: 1, unitPrice: 25 }],
    });
    expect(await received).toContain("INV-0001");
  });
});
