import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { assertFails } from "@firebase/rules-unit-testing";
import { collection, doc, setDoc } from "firebase/firestore";
import { addComment, listComments, subscribeComments } from "./comments";
import { createTask, listTasks } from "./tasks";
import { getTestEnv, memberDb, seedHierarchy, seedMember } from "./testEnv";

describe("comment data-access and validation", () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedMember("u1");
    await seedHierarchy();
    const db = await memberDb("u1");
    await createTask(db, { applicationId: "a1", projectId: "p1", clientId: "c1", title: "Review", createdBy: "u1", assigneeUid: "u1" });
  });

  afterAll(async () => { await (await getTestEnv()).cleanup(); });

  it("trims, stores, and lists valid messages", async () => {
    const db = await memberDb("u1");
    const [task] = await listTasks(db, { applicationId: "a1", clientId: "c1" });
    const message = await addComment(db, { taskId: task.id, clientId: "c1", authorUid: "u1", authorType: "member", body: "  Approved for delivery.  " });
    expect(message.body).toBe("Approved for delivery.");
    expect((await listComments(db, task.id)).map((item) => item.body)).toEqual(["Approved for delivery."]);
  });

  it("rejects oversized messages in both the API and Firestore rules", async () => {
    const db = await memberDb("u1");
    const [task] = await listTasks(db, { applicationId: "a1", clientId: "c1" });
    const oversized = "x".repeat(4001);
    await expect(addComment(db, { taskId: task.id, clientId: "c1", authorUid: "u1", authorType: "member", body: oversized })).rejects.toThrow();
    await assertFails(setDoc(doc(collection(db, "comments")), { taskId: task.id, clientId: "c1", authorUid: "u1", authorType: "member", body: oversized, createdAt: Date.now() }));
  });

  it("pushes new messages to an open live conversation", async () => {
    const db = await memberDb("u1");
    const [task] = await listTasks(db, { applicationId: "a1", clientId: "c1" });
    const received = new Promise<string[]>((resolve, reject) => {
      let unsubscribe = () => {};
      const timeout = setTimeout(() => { unsubscribe(); reject(new Error("Comment subscription timed out")); }, 5000);
      unsubscribe = subscribeComments(db, task.id, (items) => {
        if (!items.some((item) => item.body === "Live reply")) return;
        clearTimeout(timeout); unsubscribe(); resolve(items.map((item) => item.body));
      }, reject);
    });
    await addComment(db, { taskId: task.id, clientId: "c1", authorUid: "u1", authorType: "member", body: "Live reply" });
    expect(await received).toContain("Live reply");
  });
});
