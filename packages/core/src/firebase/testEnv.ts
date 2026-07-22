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

export async function seedMember(uid: string, role: "owner" | "admin" | "member" = "owner", status: "active" | "disabled" = "active"): Promise<void> {
  const env = await getTestEnv();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore() as unknown as Firestore, `members/${uid}`), {
      uid, name: "Test", email: `${uid}@test.com`,
      role, status, createdAt: 1,
    });
  });
}

export async function seedHierarchy({ clientId = "c1", projectId = "p1", applicationId = "a1" } = {}): Promise<void> {
  const env = await getTestEnv();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const firestore = ctx.firestore() as unknown as Firestore;
    await setDoc(doc(firestore, `clients/${clientId}`), { name: clientId, email: `${clientId}@test.com`, status: "active", createdAt: 1 });
    await setDoc(doc(firestore, `projects/${projectId}`), { clientId, name: projectId, status: "active", createdAt: 1 });
    await setDoc(doc(firestore, `applications/${applicationId}`), { projectId, clientId, name: applicationId, status: "active", createdAt: 1 });
  });
}

export async function seedClient(clientId = "c1"): Promise<void> {
  const env = await getTestEnv();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const firestore = ctx.firestore() as unknown as Firestore;
    await setDoc(doc(firestore, `clients/${clientId}`), { name: clientId, email: `${clientId}@test.com`, status: "active", createdAt: 1 });
  });
}

export async function memberDb(uid: string): Promise<Firestore> {
  const env = await getTestEnv();
  return env.authenticatedContext(uid).firestore() as unknown as Firestore;
}

/** Firestore acting as a signed-in client (custom claims role=client, clientId). */
export async function clientDb(uid: string, clientId: string): Promise<Firestore> {
  const env = await getTestEnv();
  return env
    .authenticatedContext(uid, { role: "client", clientId })
    .firestore() as unknown as Firestore;
}
