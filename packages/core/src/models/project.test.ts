import { describe, it, expect } from "vitest";
import { parseProject } from "./project";
import { parseApplication } from "./application";

describe("parseProject", () => {
  it("accepts a valid project and defaults status to active", () => {
    const p = parseProject({ id: "p1", clientId: "c1", name: "Site", createdAt: 1 });
    expect(p.status).toBe("active");
  });
  it("rejects a missing clientId", () => {
    expect(() => parseProject({ id: "p1", name: "Site", createdAt: 1 })).toThrow();
  });
});

describe("parseApplication", () => {
  it("accepts a valid application", () => {
    const a = parseApplication({ id: "a1", projectId: "p1", clientId: "c1", name: "API", createdAt: 1 });
    expect(a.status).toBe("active");
  });
  it("rejects a missing projectId", () => {
    expect(() => parseApplication({ id: "a1", clientId: "c1", name: "API", createdAt: 1 })).toThrow();
  });
});
