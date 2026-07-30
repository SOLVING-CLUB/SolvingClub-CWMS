import { describe, it, beforeEach, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { getTestEnv, seedHierarchy, seedMember } from "./testEnv";

describe("member rule behavior", () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
  });
  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it("denies unauthenticated reads of clients", async () => {
    const env = await getTestEnv();
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "clients/c1")));
  });

  it("denies a signed-in non-member", async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext("stranger").firestore();
    await assertFails(getDoc(doc(db, "clients/c1")));
  });

  it("allows a seeded member to read clients", async () => {
    await seedMember("u1");
    const env = await getTestEnv();
    const db = env.authenticatedContext("u1").firestore();
    await assertSucceeds(getDoc(doc(db, "clients/c1")));
  });

  it("allows owners/admins to manage clients but denies regular members", async () => {
    await seedMember("owner", "owner");
    await seedMember("member", "member");
    const env = await getTestEnv();
    const owner = env.authenticatedContext("owner").firestore();
    const member = env.authenticatedContext("member").firestore();
    const record = { name: "Acme", email: "a@b.com", status: "active", createdAt: 1 };
    await assertSucceeds(setDoc(doc(owner, "clients/c1"), record));
    await assertFails(setDoc(doc(member, "clients/c2"), record));
  });

  it("allows a member to create tasks and edit only tasks assigned to them", async () => {
    await seedMember("member", "member");
    await seedHierarchy();
    const env = await getTestEnv();
    const member = env.authenticatedContext("member").firestore();
    const task = {
      applicationId: "a1", projectId: "p1", clientId: "c1", title: "Assigned",
      status: "todo", priority: 3, order: 1, assigneeUid: "member", createdBy: "member", createdAt: 1,
    };
    await assertSucceeds(setDoc(doc(member, "tasks/t1"), task));
    await assertFails(setDoc(doc(member, "tasks/invalid-priority"), { ...task, priority: 6 }));
    await assertSucceeds(updateDoc(doc(member, "tasks/t1"), { status: "done" }));
    await assertFails(updateDoc(doc(member, "tasks/t1"), { priority: 0 }));
    await assertFails(updateDoc(doc(member, "tasks/t1"), { assigneeUid: "someone-else" }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "tasks/t2"), { ...task, assigneeUid: "someone-else" });
    });
    await assertFails(updateDoc(doc(member, "tasks/t2"), { status: "done" }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), "applications/a1"), { status: "archived" });
    });
    await assertFails(setDoc(doc(member, "tasks/archived-application"), { ...task, title: "Should not start" }));
  });

  it("requires a complete, well-formed invoice document from admins", async () => {
    await seedMember("owner", "owner");
    await seedHierarchy();
    const env = await getTestEnv();
    const owner = env.authenticatedContext("owner").firestore();
    const invoice = {
      clientId: "c1", number: "INV-0001", status: "draft", currency: "USD", total: 100,
      lineItems: [{ description: "Design", quantity: 1, unitPrice: 100 }], issueDate: 1, createdBy: "owner", createdAt: 1,
    };
    await assertSucceeds(setDoc(doc(owner, "invoices/i1"), invoice));
    await assertFails(setDoc(doc(owner, "invoices/i2"), { ...invoice, currency: "usd" }));
    await assertFails(setDoc(doc(owner, "invoices/i3"), { ...invoice, number: "1" }));
    await assertFails(setDoc(doc(owner, "invoices/i4"), { ...invoice, lineItems: [] }));
  });

  it("denies disabled members", async () => {
    await seedMember("disabled", "member", "disabled");
    const env = await getTestEnv();
    const db = env.authenticatedContext("disabled").firestore();
    await assertFails(getDoc(doc(db, "clients/c1")));
    await assertSucceeds(getDoc(doc(db, "members/disabled")));
    await assertFails(getDoc(doc(db, "members/someone-else")));
  });
});
