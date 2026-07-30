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
  it("accepts a type, start date, and tech stack", () => {
    const p = parseProject({
      id: "p1", clientId: "c1", name: "Site", createdAt: 1,
      type: "mobile_app", startDate: 1767225600000, techStack: ["React Native", "Firebase"],
    });
    expect(p.type).toBe("mobile_app");
    expect(p.startDate).toBe(1767225600000);
    expect(p.techStack).toEqual(["React Native", "Firebase"]);
  });
  it("still parses a project created before those fields existed", () => {
    const p = parseProject({ id: "p1", clientId: "c1", name: "Legacy", createdAt: 1 });
    expect(p.type).toBeUndefined();
    expect(p.startDate).toBeUndefined();
    expect(p.techStack).toBeUndefined();
  });
  it("rejects an unknown project type", () => {
    expect(() => parseProject({ id: "p1", clientId: "c1", name: "Site", createdAt: 1, type: "spaceship" })).toThrow();
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
