import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { getTestEnv, clientDb } from "./testEnv";
import { listProjectsByClient } from "./projects";
import { listApplicationsByProject, subscribeApplicationsByClient } from "./applications";
import { listTasks } from "./tasks";
import { listDocumentsByClient } from "./documents";

async function seed() {
  const env = await getTestEnv();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, "clients/c1"), { name: "Acme" });
    await setDoc(doc(d, "clients/c2"), { name: "Other" });
    await setDoc(doc(d, "projects/p1"), { clientId: "c1", name: "P1", status: "active", createdAt: 1 });
    await setDoc(doc(d, "applications/a1"), {
      projectId: "p1", clientId: "c1", name: "App 1", status: "active", createdAt: 1,
    });
    await setDoc(doc(d, "tasks/t1"), {
      applicationId: "a1", projectId: "p1", clientId: "c1", title: "T1",
      status: "todo", priority: 3, order: 1, createdBy: "u1", createdAt: 1,
    });
    await setDoc(doc(d, "tasks/t2"), { clientId: "c2", title: "T2", status: "todo", priority: 3, order: 1 });
    await setDoc(doc(d, "documents/d1"), {
      kind: "linked", label: "Acme brief", url: "https://example.com/acme-brief",
      accessLevel: "client", ownerType: "application", ownerId: "a1", clientId: "c1", uploadedBy: "u1", createdAt: 1,
    });
    await setDoc(doc(d, "documents/d2"), {
      kind: "linked", label: "Other brief", url: "https://example.com/other-brief",
      accessLevel: "client", ownerType: "application", ownerId: "a2", clientId: "c2", uploadedBy: "u1", createdAt: 1,
    });
    // Same client as d1, but internal — must stay invisible to the client.
    await setDoc(doc(d, "documents/d3"), {
      kind: "linked", label: "Acme internal margins", url: "https://example.com/acme-margins",
      accessLevel: "internal", ownerType: "application", ownerId: "a1", clientId: "c1", uploadedBy: "u1", createdAt: 1,
    });
    await setDoc(doc(d, "documents/d4"), {
      kind: "linked", label: "Workspace ops", url: "https://example.com/ops",
      accessLevel: "internal", ownerType: "workspace", ownerId: "__workspace__", clientId: "__workspace__", uploadedBy: "u1", createdAt: 1,
    });
    await setDoc(doc(d, "notifications/n1"), {
      recipientType: "client", recipientId: "c1", title: "For c1", read: false, createdAt: 1,
    });
    await setDoc(doc(d, "notifications/n2"), {
      recipientType: "client", recipientId: "c2", title: "For c2", read: false, createdAt: 1,
    });
    await setDoc(doc(d, "invoices/i1"), {
      clientId: "c1", number: "INV-0001", status: "draft",
      lineItems: [{ description: "Work", quantity: 1, unitPrice: 100 }],
      currency: "USD", total: 100, issueDate: 1, createdBy: "u1", createdAt: 1,
    });
    await setDoc(doc(d, "invoices/i2"), {
      clientId: "c2", number: "INV-0002", status: "draft",
      lineItems: [{ description: "Work", quantity: 1, unitPrice: 100 }],
      currency: "USD", total: 100, issueDate: 1, createdBy: "u1", createdAt: 1,
    });
  });
}

describe("client-scoped rules", () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seed();
  });
  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it("reads its own client + project, but not another client's task", async () => {
    const db = await clientDb("client1", "c1");
    await assertSucceeds(getDoc(doc(db, "clients/c1")));
    await assertSucceeds(getDoc(doc(db, "projects/p1")));
    await assertFails(getDoc(doc(db, "tasks/t2")));
  });

  it("lists its complete project hierarchy with client-scoped queries", async () => {
    const db = await clientDb("client1", "c1");
    await expect(listProjectsByClient(db, "c1")).resolves.toHaveLength(1);
    await expect(listApplicationsByProject(db, "p1", "c1")).resolves.toHaveLength(1);
    await expect(listTasks(db, { applicationId: "a1", clientId: "c1" })).resolves.toHaveLength(1);
  });

  it("can stream its own applications with the client ownership constraint", async () => {
    const db = await clientDb("client1", "c1");
    await new Promise<void>((resolve, reject) => {
      const stop = subscribeApplicationsByClient(db, "c1", (items) => {
        try { expect(items).toHaveLength(1); stop(); resolve(); } catch (error) { stop(); reject(error); }
      }, reject);
    });
  });

  it("may reprioritize its own task but not edit the title", async () => {
    const db = await clientDb("client1", "c1");
    await assertSucceeds(updateDoc(doc(db, "tasks/t1"), { priority: 1 }));
    await assertFails(updateDoc(doc(db, "tasks/t1"), { title: "hacked" }));
  });

  it("may comment on its own task, but not on another client's", async () => {
    const db = await clientDb("client1", "c1");
    await assertSucceeds(setDoc(doc(db, "comments/cm1"), {
      taskId: "t1", clientId: "c1", authorUid: "client1", authorType: "client", body: "hi", createdAt: 1,
    }));
    await assertFails(setDoc(doc(db, "comments/cm2"), {
      taskId: "t2", clientId: "c2", authorUid: "client1", authorType: "client", body: "hi", createdAt: 1,
    }));
  });

  it("reads documents shared with its own delivery work, but cannot write document records", async () => {
    const db = await clientDb("client1", "c1");
    await assertSucceeds(getDoc(doc(db, "documents/d1")));
    await assertFails(getDoc(doc(db, "documents/d2")));
    await expect(listDocumentsByClient(db, "c1")).resolves.toHaveLength(1);
    await assertFails(setDoc(doc(db, "documents/client-write"), {
      kind: "linked", label: "Untrusted", url: "https://example.com/untrusted",
      accessLevel: "client", ownerType: "application", ownerId: "a1", clientId: "c1", uploadedBy: "client1", createdAt: 1,
    }));
  });

  it("cannot read its own client's internal documents, nor the workspace vault", async () => {
    const db = await clientDb("client1", "c1");
    await assertFails(getDoc(doc(db, "documents/d3")));
    await assertFails(getDoc(doc(db, "documents/d4")));
    // The client-scoped listing must exclude the internal record too.
    const shared = await listDocumentsByClient(db, "c1");
    expect(shared.map((item) => item.label)).toEqual(["Acme brief"]);
  });

  it("reads and marks its own notification read, but not another client's", async () => {
    const db = await clientDb("client1", "c1");
    await assertSucceeds(getDoc(doc(db, "notifications/n1")));
    await assertFails(getDoc(doc(db, "notifications/n2")));
    await assertSucceeds(updateDoc(doc(db, "notifications/n1"), { read: true }));
    await assertFails(updateDoc(doc(db, "notifications/n1"), { title: "hacked" }));
  });

  it("reads its own invoice but not another client's, and cannot write invoices", async () => {
    const db = await clientDb("client1", "c1");
    await assertSucceeds(getDoc(doc(db, "invoices/i1")));
    await assertFails(getDoc(doc(db, "invoices/i2")));
    await assertFails(updateDoc(doc(db, "invoices/i1"), { status: "paid" }));
  });
});
