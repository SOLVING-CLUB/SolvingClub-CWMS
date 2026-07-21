import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestEnv, seedMember, memberDb, clientDb } from "./testEnv";
import {
  createNotification, listMemberNotifications, listClientNotifications, markNotificationRead,
  ORG_BROADCAST,
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

  it("delivers a direct member notification and an org broadcast to that member", async () => {
    const db = await memberDb("u1");
    await createNotification(db, { recipientType: "member", recipientId: "u1", title: "Direct" });
    await createNotification(db, { recipientType: "member", recipientId: ORG_BROADCAST, title: "Broadcast" });
    await createNotification(db, { recipientType: "member", recipientId: "someone-else", title: "Not mine" });

    const mine = await listMemberNotifications(db, "u1");
    expect(mine.map((n) => n.title).sort()).toEqual(["Broadcast", "Direct"]);
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
});
