import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestEnv, seedMember, memberDb } from "./testEnv";
import { createClient, listClients } from "./clients";

describe("client data-access (as authenticated member)", () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedMember("u1");
  });
  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it("creates and lists a client under real member rules", async () => {
    const db = await memberDb("u1");
    const created = await createClient(db, { name: "Acme", email: "a@acme.com" });
    expect(created.id).toBeTruthy();
    expect(created.status).toBe("active");

    const all = await listClients(db);
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("Acme");
  });
});
