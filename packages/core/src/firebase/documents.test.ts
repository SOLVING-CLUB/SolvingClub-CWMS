import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestEnv, seedHierarchy, seedMember, memberDb } from "./testEnv";
import { addLinkedDocument, listDocuments, subscribeDocuments, deleteDocument } from "./documents";

describe("document data-access (as member)", () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedMember("u1");
    await seedHierarchy();
  });
  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it("adds a linked document, lists it by owner, and deletes it", async () => {
    const db = await memberDb("u1");
    const d = await addLinkedDocument(db, {
      label: "Spec", url: "https://drive.google.com/file/abc",
      ownerType: "application", ownerId: "a1", clientId: "c1", uploadedBy: "u1",
    });
    expect(d.kind).toBe("linked");

    let all = await listDocuments(db, "a1");
    expect(all).toHaveLength(1);
    expect(all[0].label).toBe("Spec");

    await deleteDocument(db, d.id);
    all = await listDocuments(db, "a1");
    expect(all).toHaveLength(0);
  });

  it("rejects unsafe links before writing a document", async () => {
    const db = await memberDb("u1");
    await expect(addLinkedDocument(db, {
      label: "Unsafe", url: "javascript:alert(1)",
      ownerType: "application", ownerId: "a1", clientId: "c1", uploadedBy: "u1",
    })).rejects.toThrow();
    expect(await listDocuments(db, "a1")).toHaveLength(0);
  });

  it("keeps an owner's document collection synchronized", async () => {
    const db = await memberDb("u1");
    const received = new Promise<string[]>((resolve, reject) => {
      let unsubscribe = () => {};
      const timeout = setTimeout(() => { unsubscribe(); reject(new Error("Document subscription timed out")); }, 5000);
      unsubscribe = subscribeDocuments(db, "a1", (items) => {
        if (!items.some((item) => item.label === "Live spec")) return;
        clearTimeout(timeout); unsubscribe(); resolve(items.map((item) => item.label));
      }, reject);
    });
    await addLinkedDocument(db, {
      label: "Live spec", url: "https://example.com/live", ownerType: "application", ownerId: "a1", clientId: "c1", uploadedBy: "u1",
    });
    expect(await received).toContain("Live spec");
  });
});
