import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { listMembers, subscribeMembers } from "./members";
import { getTestEnv, memberDb, seedMember } from "./testEnv";

describe("member directory data-access", () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedMember("u1", "owner");
  });
  afterAll(async () => { await (await getTestEnv()).cleanup(); });

  it("lists authenticated workspace members", async () => {
    await seedMember("u2", "member");
    const members = await listMembers(await memberDb("u1"));
    expect(members.map((member) => member.uid).sort()).toEqual(["u1", "u2"]);
  });

  it("keeps the access directory synchronized", async () => {
    const db = await memberDb("u1");
    const received = new Promise<string[]>((resolve, reject) => {
      let unsubscribe = () => {};
      const timeout = setTimeout(() => { unsubscribe(); reject(new Error("Member subscription timed out")); }, 5000);
      unsubscribe = subscribeMembers(db, (items) => {
        if (!items.some((item) => item.uid === "u2")) return;
        clearTimeout(timeout); unsubscribe(); resolve(items.map((item) => item.uid));
      }, reject);
    });
    await seedMember("u2", "admin");
    expect(await received).toContain("u2");
  });
});
