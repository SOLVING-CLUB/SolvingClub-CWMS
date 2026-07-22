import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestEnv, seedMember, memberDb, clientDb } from "./testEnv";
import {
  createNotification, listMemberNotifications, listClientNotifications, markNotificationRead,
  markNotificationsRead,
  subscribeMemberNotifications,
} from "./notifications";

describe("notifications data-access", () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedMember("u1");
  });
  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it("delivers only recipient-specific member notifications", async () => {
    const db = await memberDb("u1");
    await createNotification(db, { recipientType: "member", recipientId: "u1", title: "Direct" });
    await createNotification(db, { recipientType: "member", recipientId: "someone-else", title: "Not mine" });

    const mine = await listMemberNotifications(db, "u1");
    expect(mine.map((n) => n.title)).toEqual(["Direct"]);
  });

  it("marks multiple recipient-specific notifications read in one batch", async () => {
    const db = await memberDb("u1");
    const first = await createNotification(db, { recipientType: "member", recipientId: "u1", title: "First" });
    const second = await createNotification(db, { recipientType: "member", recipientId: "u1", title: "Second" });
    await markNotificationsRead(db, [first.id, second.id]);
    expect((await listMemberNotifications(db, "u1")).every((item) => item.read)).toBe(true);
  });

  it("delivers a client notification only to that client and supports mark-as-read", async () => {
    const memberSide = await memberDb("u1");
    const n = await createNotification(memberSide, {
      recipientType: "client", recipientId: "c1", title: "Task done",
    });
    expect(n.read).toBe(false);

    const asClient = await clientDb("client1", "c1");
    const forClient = await listClientNotifications(asClient, "c1");
    expect(forClient).toHaveLength(1);

    await markNotificationRead(asClient, n.id);
    const afterRead = await listClientNotifications(asClient, "c1");
    expect(afterRead[0].read).toBe(true);
  });

  it("pushes recipient-specific notifications through the live subscription", async () => {
    const db = await memberDb("u1");
    const received = new Promise<string[]>((resolve, reject) => {
      let unsubscribe = () => {};
      const timeout = setTimeout(() => { unsubscribe(); reject(new Error("Notification subscription timed out")); }, 5000);
      unsubscribe = subscribeMemberNotifications(db, "u1", (items) => {
        if (!items.some((item) => item.title === "Live update")) return;
        clearTimeout(timeout); unsubscribe(); resolve(items.map((item) => item.title));
      }, reject);
    });
    await createNotification(db, { recipientType: "member", recipientId: "u1", title: "Live update" });
    expect(await received).toContain("Live update");
  });
});
