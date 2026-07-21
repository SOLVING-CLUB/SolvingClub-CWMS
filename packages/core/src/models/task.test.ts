import { describe, it, expect } from "vitest";
import { parseTask } from "./task";

const base = {
  id: "t1", applicationId: "a1", projectId: "p1", clientId: "c1",
  title: "Do it", status: "todo", priority: 1, order: 1,
  createdBy: "u1", createdAt: 1,
};

describe("parseTask", () => {
  it("accepts a valid task", () => {
    const t = parseTask(base);
    expect(t.status).toBe("todo");
    expect(t.priority).toBe(1);
  });
  it("rejects an invalid status", () => {
    expect(() => parseTask({ ...base, status: "later" })).toThrow();
  });
  it("rejects a missing title", () => {
    const { title, ...noTitle } = base;
    expect(() => parseTask(noTitle)).toThrow();
  });
});
