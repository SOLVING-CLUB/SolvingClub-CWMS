import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestEnv, seedMember, memberDb } from "./testEnv";
import { createClient, listClients, subscribeClient, subscribeClients, updateClient } from "./clients";

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

  it("rejects invalid client data before it reaches Firestore", async () => {
    const db = await memberDb("u1");
    await expect(createClient(db, { name: "Acme", email: "not-an-email" })).rejects.toThrow();
    expect(await listClients(db)).toHaveLength(0);
  });

  it("updates validated relationship details", async () => {
    const db = await memberDb("u1");
    const client = await createClient(db, { name: "Acme", email: "a@acme.com" });
    await updateClient(db, client.id, { name: "Acme Studio", phone: "+91 555 0100", status: "archived" });
    const [updated] = await listClients(db);
    expect(updated).toMatchObject({ name: "Acme Studio", phone: "+91 555 0100", status: "archived" });
  });

  it("keeps the client directory synchronized", async () => {
    const db = await memberDb("u1");
    const received = new Promise<string[]>((resolve, reject) => {
      let unsubscribe = () => {};
      const timeout = setTimeout(() => { unsubscribe(); reject(new Error("Client subscription timed out")); }, 5000);
      unsubscribe = subscribeClients(db, (items) => {
        if (!items.some((item) => item.name === "Live client")) return;
        clearTimeout(timeout); unsubscribe(); resolve(items.map((item) => item.name));
      }, reject);
    });
    await createClient(db, { name: "Live client", email: "live@example.com" });
    expect(await received).toContain("Live client");
  });

  it("keeps an individual client profile synchronized", async () => {
    const db = await memberDb("u1");
    const client = await createClient(db, { name: "Initial", email: "initial@example.com" });
    const received = new Promise<string>((resolve, reject) => {
      let unsubscribe = () => {};
      const timeout = setTimeout(() => { unsubscribe(); reject(new Error("Client profile subscription timed out")); }, 5000);
      unsubscribe = subscribeClient(db, client.id, (item) => {
        if (item?.name !== "Live profile") return;
        clearTimeout(timeout); unsubscribe(); resolve(item.name);
      }, reject);
    });
    await updateClient(db, client.id, { name: "Live profile" });
    expect(await received).toBe("Live profile");
  });
});
