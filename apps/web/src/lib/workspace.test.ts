import { describe, expect, it } from "vitest";
import type { Client } from "@solvingclub/core";
import { canEditTask, filterClients, resolveTaskAssignee } from "./workspace";

const clients = [
  { id: "c1", name: "Acme Studio", email: "hello@acme.test", status: "active", createdAt: 1 },
  { id: "c2", name: "North Star", email: "ops@north.test", status: "active", createdAt: 2 },
] satisfies Client[];

describe("workspace interaction rules", () => {
  it("filters clients by name or email without case sensitivity", () => {
    expect(filterClients(clients, "ACME").map((client) => client.id)).toEqual(["c1"]);
    expect(filterClients(clients, "ops@north").map((client) => client.id)).toEqual(["c2"]);
    expect(filterClients(clients, "   ")).toHaveLength(2);
  });

  it("assigns member-created tasks to the current member", () => {
    expect(resolveTaskAssignee(false, "member-1", "someone-else")).toBe("member-1");
    expect(resolveTaskAssignee(true, "admin-1", "member-2")).toBe("member-2");
    expect(resolveTaskAssignee(true, "admin-1", "")).toBeUndefined();
  });

  it("allows task editing only for admins or the assignee", () => {
    expect(canEditTask(true, "admin-1", undefined)).toBe(true);
    expect(canEditTask(false, "member-1", "member-1")).toBe(true);
    expect(canEditTask(false, "member-1", "member-2")).toBe(false);
  });
});
