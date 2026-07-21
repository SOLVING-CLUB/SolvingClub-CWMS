import { describe, it, beforeEach, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc } from "firebase/firestore";
import { getTestEnv, seedMember } from "./testEnv";

describe("member rule behavior", () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
  });
  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it("denies unauthenticated reads of clients", async () => {
    const env = await getTestEnv();
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "clients/c1")));
  });

  it("denies a signed-in non-member", async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext("stranger").firestore();
    await assertFails(getDoc(doc(db, "clients/c1")));
  });

  it("allows a seeded member to read clients", async () => {
    await seedMember("u1");
    const env = await getTestEnv();
    const db = env.authenticatedContext("u1").firestore();
    await assertSucceeds(getDoc(doc(db, "clients/c1")));
  });
});
