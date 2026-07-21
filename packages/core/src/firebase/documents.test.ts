import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestEnv, seedMember, memberDb } from "./testEnv";
import { addLinkedDocument, listDocuments, deleteDocument } from "./documents";

describe("document data-access (as member)", () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedMember("u1");
  });
  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it("adds a linked document, lists it by owner, and deletes it", async () => {
    const db = await memberDb("u1");
    const d = await addLinkedDocument(db, {
      label: "Spec", url: "https://drive.google.com/file/abc",
      ownerType: "task", ownerId: "t1", clientId: "c1", uploadedBy: "u1",
    });
    expect(d.kind).toBe("linked");

    let all = await listDocuments(db, "t1");
    expect(all).toHaveLength(1);
    expect(all[0].label).toBe("Spec");

    await deleteDocument(db, d.id);
    all = await listDocuments(db, "t1");
    expect(all).toHaveLength(0);
  });
});
