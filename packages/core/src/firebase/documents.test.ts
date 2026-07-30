import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
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
      accessLevel: "internal", ownerType: "application", ownerId: "a1", clientId: "c1", uploadedBy: "u1",
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
      accessLevel: "internal", ownerType: "application", ownerId: "a1", clientId: "c1", uploadedBy: "u1",
    })).rejects.toThrow();
    expect(await listDocuments(db, "a1")).toHaveLength(0);
  });

  it("loads legacy documents without an access level as internal", async () => {
    const env = await getTestEnv();
    const db = await memberDb("u1");
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "documents/legacy"), {
        kind: "linked", label: "Legacy spec", url: "https://example.com/legacy",
        ownerType: "application", ownerId: "a1", clientId: "c1", uploadedBy: "u1", createdAt: 1,
      });
    });

    const all = await listDocuments(db, "a1");
    expect(all).toHaveLength(1);
    expect(all[0].accessLevel).toBe("internal");
  });

  it("rejects document records with fields outside the approved linked-document shape", async () => {
    const db = await memberDb("u1");
    await assertFails(setDoc(doc(db, "documents/untrusted"), {
      kind: "linked", label: "Spec", url: "https://example.com/spec",
      accessLevel: "internal", ownerType: "application", ownerId: "a1", clientId: "c1", uploadedBy: "u1", createdAt: 1,
      internalOnly: "must not be stored",
    }));
  });

  it("stores a workspace-vault document under the internal sentinel owner", async () => {
    const db = await memberDb("u1");
    await assertSucceeds(setDoc(doc(db, "documents/ws1"), {
      kind: "linked", label: "Ops policy", url: "https://example.com/ops",
      accessLevel: "internal", ownerType: "workspace",
      ownerId: "__workspace__", clientId: "__workspace__", uploadedBy: "u1", createdAt: 1,
    }));
  });

  it("never lets a workspace-vault document be marked client-visible", async () => {
    const db = await memberDb("u1");
    await assertFails(setDoc(doc(db, "documents/ws-shared"), {
      kind: "linked", label: "Internal margins", url: "https://example.com/margins",
      accessLevel: "client", ownerType: "workspace",
      ownerId: "__workspace__", clientId: "__workspace__", uploadedBy: "u1", createdAt: 1,
    }));
  });

  it("rejects a workspace document that points at a real client instead of the sentinel", async () => {
    const db = await memberDb("u1");
    await assertFails(setDoc(doc(db, "documents/ws-leak"), {
      kind: "linked", label: "Mislabelled", url: "https://example.com/mislabelled",
      accessLevel: "internal", ownerType: "workspace",
      ownerId: "c1", clientId: "c1", uploadedBy: "u1", createdAt: 1,
    }));
  });

  it("keeps managed and linked document shapes from blending", async () => {
    const db = await memberDb("u1");
    // managed without its Drive metadata
    await assertFails(setDoc(doc(db, "documents/bad-managed"), {
      kind: "managed", label: "No drive id", url: "https://example.com/x",
      accessLevel: "internal", ownerType: "application", ownerId: "a1", clientId: "c1",
      uploadedBy: "u1", createdAt: 1,
    }));
    // linked smuggling Drive metadata
    await assertFails(setDoc(doc(db, "documents/bad-linked"), {
      kind: "linked", label: "Pretend managed", url: "https://example.com/y",
      driveFileId: "spoofed", mimeType: "application/pdf",
      accessLevel: "internal", ownerType: "application", ownerId: "a1", clientId: "c1",
      uploadedBy: "u1", createdAt: 1,
    }));
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
      label: "Live spec", url: "https://example.com/live", accessLevel: "internal", ownerType: "application", ownerId: "a1", clientId: "c1", uploadedBy: "u1",
    });
    expect(await received).toContain("Live spec");
  });
});
