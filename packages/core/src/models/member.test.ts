import { describe, it, expect } from "vitest";
import { parseMember } from "./member";

describe("parseMember", () => {
  it("accepts a valid member", () => {
    const m = parseMember({
      uid: "u1", name: "Bhanu", email: "b@x.com",
      role: "owner", status: "active", createdAt: 1,
    });
    expect(m.role).toBe("owner");
  });

  it("rejects an invalid role", () => {
    expect(() => parseMember({
      uid: "u1", name: "B", email: "b@x.com",
      role: "superuser", status: "active", createdAt: 1,
    })).toThrow();
  });

  it("rejects a non-email", () => {
    expect(() => parseMember({
      uid: "u1", name: "B", email: "nope",
      role: "member", status: "active", createdAt: 1,
    })).toThrow();
  });
});
