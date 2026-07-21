import { describe, it, beforeEach, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { getTestEnv, clientDb } from "./testEnv";

async function seed() {
  const env = await getTestEnv();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, "clients/c1"), { name: "Acme" });
    await setDoc(doc(d, "clients/c2"), { name: "Other" });
    await setDoc(doc(d, "projects/p1"), { clientId: "c1", name: "P1" });
    await setDoc(doc(d, "tasks/t1"), { clientId: "c1", title: "T1", status: "todo", priority: 3, order: 1 });
    await setDoc(doc(d, "tasks/t2"), { clientId: "c2", title: "T2", status: "todo", priority: 3, order: 1 });
    await setDoc(doc(d, "notifications/n1"), {
      recipientType: "client", recipientId: "c1", title: "For c1", read: false, createdAt: 1,
    });
    await setDoc(doc(d, "notifications/n2"), {
      recipientType: "client", recipientId: "c2", title: "For c2", read: false, createdAt: 1,
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

  it("reads and marks its own notification read, but not another client's", async () => {
    const db = await clientDb("client1", "c1");
    await assertSucceeds(getDoc(doc(db, "notifications/n1")));
    await assertFails(getDoc(doc(db, "notifications/n2")));
    await assertSucceeds(updateDoc(doc(db, "notifications/n1"), { read: true }));
    await assertFails(updateDoc(doc(db, "notifications/n1"), { title: "hacked" }));
  });
});
