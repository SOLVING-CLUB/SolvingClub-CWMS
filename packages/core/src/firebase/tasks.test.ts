import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestEnv, seedMember, memberDb } from "./testEnv";
import { createTask, listTasks, updateTask, deleteTask } from "./tasks";

const base = {
  applicationId: "a1", projectId: "p1", clientId: "c1", createdBy: "u1",
};

describe("task data-access (as member)", () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedMember("u1");
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
    await createTask(db, { ...base, clientId: "other", title: "Other", priority: 1 });

    const mine = await listTasks(db, { clientId: "c1" });
    expect(mine.map((t) => t.title)).toEqual(["High", "Low"]);
  });

  it("updates and deletes a task", async () => {
    const db = await memberDb("u1");
    const t = await createTask(db, { ...base, title: "Edit me" });
    await updateTask(db, t.id, { status: "done" });
    let all = await listTasks(db, { clientId: "c1" });
    expect(all[0].status).toBe("done");
    await deleteTask(db, t.id);
    all = await listTasks(db, { clientId: "c1" });
    expect(all).toHaveLength(0);
  });
});
