import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment, type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, type Firestore } from "firebase/firestore";

let envPromise: Promise<RulesTestEnvironment> | undefined;

export function getTestEnv(): Promise<RulesTestEnvironment> {
  if (!envPromise) {
    envPromise = initializeTestEnvironment({
      projectId: "demo-rules-test",
      firestore: {
        rules: readFileSync("../../firestore.rules", "utf8"),
        host: "localhost",
        port: 8080,
      },
    });
  }
  return envPromise;
}

export async function seedMember(uid: string): Promise<void> {
  const env = await getTestEnv();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore() as unknown as Firestore, `members/${uid}`), {
      uid, name: "Test", email: `${uid}@test.com`,
      role: "owner", status: "active", createdAt: 1,
    });
  });
}

export async function memberDb(uid: string): Promise<Firestore> {
  const env = await getTestEnv();
  return env.authenticatedContext(uid).firestore() as unknown as Firestore;
}
