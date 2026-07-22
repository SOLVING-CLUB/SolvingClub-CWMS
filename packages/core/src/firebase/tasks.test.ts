import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestEnv, seedMember, seedHierarchy, memberDb } from "./testEnv";
import { createTask, listTasks, subscribeTasks, updateTask, deleteTask } from "./tasks";

const base = {
  applicationId: "a1", projectId: "p1", clientId: "c1", createdBy: "u1",
};

describe("task data-access (as member)", () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedMember("u1");
    await seedHierarchy();
    await seedHierarchy({ clientId: "other", projectId: "p2", applicationId: "a2" });
  });
  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it("creates a task with defaults", async () => {
    const db = await memberDb("u1");
    const t = await createTask(db, { ...base, title: "First" });
    expect(t.status).toBe("todo");
    expect(t.priority).toBe(3);
    expect(t.order).toBe(t.createdAt);
  });

  it("filters by clientId and sorts by priority", async () => {
    const db = await memberDb("u1");
    await createTask(db, { ...base, title: "Low", priority: 5 });
    await createTask(db, { ...base, title: "High", priority: 1 });
    await createTask(db, { ...base, applicationId: "a2", projectId: "p2", clientId: "other", title: "Other", priority: 1 });

    const mine = await listTasks(db, { clientId: "c1" });
    expect(mine.map((t) => t.title)).toEqual(["High", "Low"]);
  });

  it("updates and deletes a task", async () => {
    const db = await memberDb("u1");
    const t = await createTask(db, { ...base, title: "Edit me", description: "Context", assigneeUid: "u1", dueDate: Date.now() });
    await updateTask(db, t.id, { status: "done", description: null, assigneeUid: null, dueDate: null });
    let all = await listTasks(db, { clientId: "c1" });
    expect(all[0].status).toBe("done");
    expect(all[0]).not.toHaveProperty("description");
    expect(all[0]).not.toHaveProperty("assigneeUid");
    expect(all[0]).not.toHaveProperty("dueDate");
    await deleteTask(db, t.id);
    all = await listTasks(db, { clientId: "c1" });
    expect(all).toHaveLength(0);
  });

  it("rejects out-of-range priority before writing a task", async () => {
    const db = await memberDb("u1");
    await expect(createTask(db, { ...base, title: "Invalid", priority: 6 })).rejects.toThrow();
    expect(await listTasks(db, { clientId: "c1" })).toHaveLength(0);
  });

  it("rejects oversized task content before create or update", async () => {
    const db = await memberDb("u1");
    await expect(createTask(db, { ...base, title: "x".repeat(241) })).rejects.toThrow();
    const task = await createTask(db, { ...base, title: "Valid task" });
    await expect(updateTask(db, task.id, { title: "x".repeat(241) })).rejects.toThrow();
    await expect(updateTask(db, task.id, { description: "x".repeat(4001) })).rejects.toThrow();
    expect((await listTasks(db, { clientId: "c1" }))[0].title).toBe("Valid task");
  });

  it("keeps filtered task queues synchronized", async () => {
    const db = await memberDb("u1");
    const received = new Promise<string[]>((resolve, reject) => {
      let unsubscribe = () => {};
      const timeout = setTimeout(() => { unsubscribe(); reject(new Error("Task subscription timed out")); }, 5000);
      unsubscribe = subscribeTasks(db, { clientId: "c1" }, (items) => {
        if (!items.some((item) => item.title === "Live task")) return;
        clearTimeout(timeout); unsubscribe(); resolve(items.map((item) => item.title));
      }, reject);
    });
    await createTask(db, { ...base, title: "Live task" });
    expect(await received).toContain("Live task");
  });
});
