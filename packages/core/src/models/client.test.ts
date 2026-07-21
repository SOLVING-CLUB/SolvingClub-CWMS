import { describe, it, expect } from "vitest";
import { parseClient } from "./client";

describe("parseClient", () => {
  it("accepts a valid client and defaults status", () => {
    const c = parseClient({ id: "c1", name: "Acme", email: "a@acme.com", createdAt: 1 });
    expect(c.status).toBe("active");
  });

  it("rejects a missing name", () => {
    expect(() => parseClient({ id: "c1", email: "a@acme.com", createdAt: 1 })).toThrow();
  });
});
