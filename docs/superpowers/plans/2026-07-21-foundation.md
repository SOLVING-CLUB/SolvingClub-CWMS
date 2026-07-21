# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the SolvingClub CMS monorepo with Firebase, a shared core package (models + data access), member authentication, and Firestore security rules — a working, tested foundation the Tasks/Documents/Client plans build on.

**Architecture:** pnpm monorepo. `packages/core` holds framework-agnostic TypeScript (Zod models, Firestore data-access). `apps/web` is a React + Vite app consuming core. Firebase provides Auth + Firestore. All local testing runs against the Firebase emulator suite.

**Tech Stack:** pnpm workspaces, TypeScript 5, Vite 6 + React 19, Firebase JS SDK v11, firebase-tools (emulator), Zod 3, Vitest 2.

## Global Constraints

- Package manager: **pnpm** only (workspaces). Never `npm install` inside a package.
- Language: **TypeScript**, `strict: true`, everywhere.
- All business logic + data access lives in `packages/core`, never in `apps/web` components.
- Every Firestore collection record for project/app/task/document/comment carries a `clientId` field (only `members` and `clients` are top-level owners).
- Tests run against the **Firebase emulator**, never a live project.
- Firestore data-access functions are pure functions that take a `Firestore` instance as their first argument (so tests can inject the emulator instance).
- Roles: `owner`, `admin`, `member`. Task status: `todo`, `in_progress`, `blocked`, `done`.

---

### Task 1: Monorepo + tooling scaffold

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/index.ts`
- Test: `packages/core/src/sanity.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a `@solvingclub/core` package that builds and runs Vitest. Root scripts `pnpm test`, `pnpm -C packages/core build`.

- [ ] **Step 1: Create root workspace files**

`package.json`:
```json
{
  "name": "solvingclub-cms",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "pnpm -r test",
    "build": "pnpm -r build"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  },
  "packageManager": "pnpm@9.12.0"
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
  - "apps/*"
  - "functions"
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 2: Create the core package files**

`packages/core/package.json`:
```json
{
  "name": "@solvingclub/core",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "firebase": "^11.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
}
```

`packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": false
  },
  "include": ["src"]
}
```

`packages/core/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node" },
});
```

`packages/core/src/index.ts`:
```ts
export const CORE_VERSION = "0.0.0";
```

- [ ] **Step 3: Write the failing sanity test**

`packages/core/src/sanity.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { CORE_VERSION } from "./index";

describe("core package", () => {
  it("exports a version", () => {
    expect(CORE_VERSION).toBe("0.0.0");
  });
});
```

- [ ] **Step 4: Install and run**

Run:
```bash
pnpm install
pnpm -C packages/core test
```
Expected: 1 test file, 1 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm monorepo with core package"
```

---

### Task 2: Core models (Member, Client)

**Files:**
- Create: `packages/core/src/models/enums.ts`
- Create: `packages/core/src/models/member.ts`
- Create: `packages/core/src/models/client.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/models/member.test.ts`
- Test: `packages/core/src/models/client.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `Role = "owner" | "admin" | "member"`, `MemberStatus = "active" | "invited" | "disabled"`.
  - `memberSchema` (Zod) and `Member` type: `{ uid: string; name: string; email: string; role: Role; status: MemberStatus; createdAt: number }`.
  - `clientSchema` (Zod) and `Client` type: `{ id: string; name: string; email: string; phone?: string; driveFolderId?: string; status: "active" | "archived"; createdAt: number }`.
  - `parseMember(input): Member`, `parseClient(input): Client` (throw on invalid).

- [ ] **Step 1: Write failing tests**

`packages/core/src/models/member.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseMember } from "./member";

describe("parseMember", () => {
  it("accepts a valid member", () => {
    const m = parseMember({
      uid: "u1", name: "Bhanu", email: "b@x.com",
      role: "owner", status: "active", createdAt: 1,
    });
    expect(m.role).toBe("owner");
  });

  it("rejects an invalid role", () => {
    expect(() => parseMember({
      uid: "u1", name: "B", email: "b@x.com",
      role: "superuser", status: "active", createdAt: 1,
    })).toThrow();
  });

  it("rejects a non-email", () => {
    expect(() => parseMember({
      uid: "u1", name: "B", email: "nope",
      role: "member", status: "active", createdAt: 1,
    })).toThrow();
  });
});
```

`packages/core/src/models/client.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseClient } from "./client";

describe("parseClient", () => {
  it("accepts a valid client and defaults status", () => {
    const c = parseClient({ id: "c1", name: "Acme", email: "a@acme.com", createdAt: 1 });
    expect(c.status).toBe("active");
  });

  it("rejects a missing name", () => {
    expect(() => parseClient({ id: "c1", email: "a@acme.com", createdAt: 1 })).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -C packages/core test`
Expected: FAIL — cannot find `./member` / `./client`.

- [ ] **Step 3: Implement the models**

`packages/core/src/models/enums.ts`:
```ts
import { z } from "zod";

export const roleSchema = z.enum(["owner", "admin", "member"]);
export type Role = z.infer<typeof roleSchema>;

export const memberStatusSchema = z.enum(["active", "invited", "disabled"]);
export type MemberStatus = z.infer<typeof memberStatusSchema>;

export const taskStatusSchema = z.enum(["todo", "in_progress", "blocked", "done"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;
```

`packages/core/src/models/member.ts`:
```ts
import { z } from "zod";
import { roleSchema, memberStatusSchema } from "./enums";

export const memberSchema = z.object({
  uid: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  role: roleSchema,
  status: memberStatusSchema,
  createdAt: z.number(),
});

export type Member = z.infer<typeof memberSchema>;

export function parseMember(input: unknown): Member {
  return memberSchema.parse(input);
}
```

`packages/core/src/models/client.ts`:
```ts
import { z } from "zod";

export const clientSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  driveFolderId: z.string().optional(),
  status: z.enum(["active", "archived"]).default("active"),
  createdAt: z.number(),
});

export type Client = z.infer<typeof clientSchema>;

export function parseClient(input: unknown): Client {
  return clientSchema.parse(input);
}
```

- [ ] **Step 4: Export from index**

Append to `packages/core/src/index.ts`:
```ts
export * from "./models/enums";
export * from "./models/member";
export * from "./models/client";
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm -C packages/core test`
Expected: PASS — all model tests green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): add member and client models with validation"
```

---

### Task 3: Firebase + emulator config

**Files:**
- Create: `firebase.json`
- Create: `.firebaserc`
- Create: `firestore.rules`
- Create: `firestore.indexes.json`
- Create: `packages/core/src/firebase/app.ts`
- Test: none (config task; verified by emulator boot in Task 4)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `initFirebase(config): { app, auth, db }` in `packages/core/src/firebase/app.ts`.
  - `connectToEmulators(services): void` that points auth + firestore at localhost emulators.
  - A bootable emulator suite (`firebase emulators:start`).

- [ ] **Step 1: Add firebase-tools to root dev deps**

Run:
```bash
pnpm add -w -D firebase-tools@^13.0.0
```

- [ ] **Step 2: Create Firebase config files**

`firebase.json`:
```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": true }
  }
}
```

`.firebaserc` (replace `YOUR_PROJECT_ID` with the existing Firebase project id):
```json
{ "projects": { "default": "YOUR_PROJECT_ID" } }
```

`firestore.indexes.json`:
```json
{ "indexes": [], "fieldOverrides": [] }
```

`firestore.rules` (starter — deny all; real rules land in Task 6):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 3: Implement the firebase init module**

`packages/core/src/firebase/app.ts`:
```ts
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import {
  getFirestore, connectFirestoreEmulator, type Firestore,
} from "firebase/firestore";

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

export function initFirebase(config: Record<string, string>): FirebaseServices {
  const app = initializeApp(config);
  return { app, auth: getAuth(app), db: getFirestore(app) };
}

export function connectToEmulators(s: FirebaseServices): void {
  connectAuthEmulator(s.auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(s.db, "localhost", 8080);
}
```

- [ ] **Step 4: Export firebase module**

Append to `packages/core/src/index.ts`:
```ts
export * from "./firebase/app";
```

- [ ] **Step 5: Verify emulator boots**

Run:
```bash
pnpm exec firebase emulators:start --only auth,firestore &
sleep 8 && curl -s http://localhost:8080 >/dev/null && echo OK
kill %1
```
Expected: prints `OK` (Firestore emulator responding).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: add firebase config, emulator suite, and core init module"
```

---

### Task 4: Client data-access, tested as an authenticated member

This task installs the real member-scoped security rules and verifies the client
data-access layer works **through** those rules while signed in as a member
(using `@firebase/rules-unit-testing` to seed a member and get an authenticated
Firestore). Task 6 then adds the negative rule-behavior tests (deny paths).

**Files:**
- Create: `packages/core/src/firebase/clients.ts`
- Create: `packages/core/src/firebase/testEnv.ts`
- Modify: `firestore.rules` (replace deny-all with real member rules)
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/vitest.config.ts`
- Modify: `packages/core/package.json` (add `@firebase/rules-unit-testing` dev dep)
- Test: `packages/core/src/firebase/clients.test.ts`

**Interfaces:**
- Consumes: `Client`, `parseClient` (Task 2); `Firestore` (Task 3).
- Produces:
  - `createClient(db, input: Omit<Client,"id"|"createdAt"|"status"> & { status?: Client["status"] }): Promise<Client>` — writes to `clients`, returns the stored client with generated id + createdAt.
  - `listClients(db): Promise<Client[]>` — reads all clients ordered by `createdAt`.
  - `getTestEnv(): Promise<RulesTestEnvironment>` — shared rules-unit-testing env (reads `firestore.rules`). Reused by Task 6.
  - `seedMember(uid): Promise<void>` — writes a `members/{uid}` doc with rules disabled, so an authenticated context for `uid` passes `isMember()`. Reused by Task 6.
  - `memberDb(uid): Promise<Firestore>` — Firestore acting as signed-in member `uid`.

- [ ] **Step 1: Add the rules-testing dev dependency**

Run:
```bash
pnpm -C packages/core add -D @firebase/rules-unit-testing@^4.0.0
```

- [ ] **Step 2: Install the real member security rules**

Replace `firestore.rules`:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() { return request.auth != null; }
    function isMember() {
      return isSignedIn()
        && exists(/databases/$(database)/documents/members/$(request.auth.uid));
    }

    match /members/{uid} {
      allow read: if isSignedIn();
      allow write: if isMember();
    }

    match /clients/{id}      { allow read, write: if isMember(); }
    match /projects/{id}     { allow read, write: if isMember(); }
    match /applications/{id} { allow read, write: if isMember(); }
    match /tasks/{id}        { allow read, write: if isMember(); }
    match /documents/{id}    { allow read, write: if isMember(); }
    match /comments/{id}     { allow read, write: if isMember(); }
  }
}
```

- [ ] **Step 3: Configure Vitest for the emulator**

Replace `packages/core/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 20000,
    env: { FIRESTORE_EMULATOR_HOST: "localhost:8080" },
  },
});
```

- [ ] **Step 4: Write the shared test-env helper**

`packages/core/src/firebase/testEnv.ts` (note: `firestore.rules` is read relative to `packages/core`, the cwd when tests run via `pnpm -C packages/core test`):
```ts
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
```

- [ ] **Step 5: Write the failing test**

`packages/core/src/firebase/clients.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestEnv, seedMember, memberDb } from "./testEnv";
import { createClient, listClients } from "./clients";

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
});
```

- [ ] **Step 6: Run to verify failure**

Run:
```bash
pnpm exec firebase emulators:exec --only firestore --project demo-solvingclub "pnpm -C packages/core test clients"
```
Expected: FAIL — cannot find `./clients`.

- [ ] **Step 7: Implement the data-access module**

`packages/core/src/firebase/clients.ts`:
```ts
import {
  collection, addDoc, getDocs, query, orderBy, type Firestore,
} from "firebase/firestore";
import { parseClient, type Client } from "../models/client";

type NewClient = Omit<Client, "id" | "createdAt" | "status"> & {
  status?: Client["status"];
};

export async function createClient(db: Firestore, input: NewClient): Promise<Client> {
  const createdAt = Date.now();
  const status = input.status ?? "active";
  // Omit `phone` when absent — never store null. clientSchema's
  // `phone: z.string().optional()` accepts undefined/absent, not null.
  const ref = await addDoc(collection(db, "clients"), {
    name: input.name,
    email: input.email,
    ...(input.phone !== undefined && { phone: input.phone }),
    status, createdAt,
  });
  return parseClient({ id: ref.id, ...input, status, createdAt });
}

export async function listClients(db: Firestore): Promise<Client[]> {
  const q = query(collection(db, "clients"), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => parseClient({ id: d.id, ...d.data() }));
}
```

- [ ] **Step 8: Export the data-access module**

Append to `packages/core/src/index.ts`:
```ts
export * from "./firebase/clients";
```
(Do NOT export `testEnv` — it is test-only.)

- [ ] **Step 9: Run to verify pass**

Run:
```bash
pnpm exec firebase emulators:exec --only firestore --project demo-solvingclub "pnpm -C packages/core test clients"
```
Expected: PASS — the member-authenticated create + list succeed under the real rules.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(core): member-scoped rules + client data-access tested as member"
```

---

### Task 5: Web app shell + member login

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/firebase.ts`
- Create: `apps/web/src/auth/LoginPage.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/.env.example`

**Interfaces:**
- Consumes: `initFirebase`, `connectToEmulators` (Task 3).
- Produces: a running web app (`pnpm -C apps/web dev`) with a member email/password login screen backed by Firebase Auth, and a signed-in placeholder home.

- [ ] **Step 1: Create the web package + Vite config**

`apps/web/package.json`:
```json
{
  "name": "@solvingclub/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "echo \"no web tests yet\" && exit 0"
  },
  "dependencies": {
    "@solvingclub/core": "workspace:*",
    "firebase": "^11.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^6.0.0",
    "typescript": "^5.6.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx", "lib": ["ES2022", "DOM", "DOM.Iterable"], "noEmit": true },
  "include": ["src"]
}
```

`apps/web/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({ plugins: [react()] });
```

`apps/web/index.html`:
```html
<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>SolvingClub CMS</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```

`apps/web/.env.example`:
```
VITE_FB_API_KEY=
VITE_FB_AUTH_DOMAIN=
VITE_FB_PROJECT_ID=
VITE_FB_APP_ID=
VITE_USE_EMULATOR=true
```

- [ ] **Step 2: Wire Firebase in the web app**

`apps/web/src/firebase.ts`:
```ts
import { initFirebase, connectToEmulators, type FirebaseServices } from "@solvingclub/core";

const config = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

export const fb: FirebaseServices = initFirebase(config);
if (import.meta.env.VITE_USE_EMULATOR === "true") connectToEmulators(fb);
```

- [ ] **Step 3: Build the login page**

`apps/web/src/auth/LoginPage.tsx`:
```tsx
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { fb } from "../firebase";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(fb.auth, email, password);
    } catch {
      setError("Invalid email or password.");
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <h1>SolvingClub — Sign in</h1>
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" value={password}
        onChange={(e) => setPassword(e.target.value)} />
      <button type="submit">Sign in</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 4: App shell with auth state**

`apps/web/src/App.tsx`:
```tsx
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { fb } from "./firebase";
import { LoginPage } from "./auth/LoginPage";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => onAuthStateChanged(fb.auth, (u) => { setUser(u); setReady(true); }), []);

  if (!ready) return <p>Loading…</p>;
  if (!user) return <LoginPage />;
  return (
    <div>
      <p>Signed in as {user.email}</p>
      <button onClick={() => signOut(fb.auth)}>Sign out</button>
    </div>
  );
}
```

`apps/web/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>
);
```

- [ ] **Step 5: Install and boot**

Run:
```bash
pnpm install
cp apps/web/.env.example apps/web/.env
pnpm -C apps/web dev
```
Expected: Vite serves the app; the login form renders at the printed localhost URL. (With the emulator running you can create a member in the Auth emulator UI and sign in.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): app shell with member email/password login"
```

---

### Task 6: Member rule-behavior tests (deny/allow paths)

The real member rules were installed in Task 4. This task adds the negative and
positive rule-behavior coverage: unauthenticated is denied, a signed-in
non-member is denied, and a seeded member is allowed. It reuses the shared
`testEnv` helper from Task 4 — no new rules authoring, no new dependency.

**Files:**
- Create: `packages/core/src/firebase/rules.test.ts`

**Interfaces:**
- Consumes: `getTestEnv`, `seedMember` (Task 4); the member rules in `firestore.rules` (Task 4).
- Produces: emulator-backed rule-behavior tests proving the access model.

- [ ] **Step 1: Write the failing rule tests**

`packages/core/src/firebase/rules.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify (passes against the Task 4 rules)**

Run:
```bash
pnpm exec firebase emulators:exec --only firestore --project demo-solvingclub "pnpm -C packages/core test rules"
```
Expected: PASS — all three rule assertions hold.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(core): member rule-behavior deny/allow coverage"
```

---

## Self-Review

**Spec coverage (this plan = Phase 0 Foundation):**
- Monorepo `packages/core` + `apps/web` + `functions` workspace → Task 1 (functions dir added to workspace list; the functions package itself is created in Plan 3).
- Member/Client models → Task 2.
- Firebase Auth + Firestore + emulator → Tasks 3–5.
- Member email/password login → Task 5.
- Member security rules authored → Task 4 (installed with the data-access layer so the data-access test runs through the real rules). Rule-behavior deny/allow coverage → Task 6.
- Client data-access verified while signed in as a member (chosen approach: test through real rules, not by bypassing them) → Task 4.
- Deferred to later plans (correctly not here): tasks board (Plan 2), Drive/documents (Plan 3), client login/comments/reprioritize (Plan 4). `clientId`-everywhere constraint recorded in Global Constraints for those plans.

**Placeholder scan:** `.firebaserc` uses `demo-solvingclub` (emulator-only; real prod id filled in at deploy). No other placeholders.

**Type consistency:** `FirebaseServices`, `initFirebase`, `connectToEmulators` used identically in Tasks 3 and 5 (web). `getTestEnv`/`seedMember`/`memberDb` defined in Task 4's `testEnv.ts` and reused verbatim in Task 6. `parseClient`/`Client` shape consistent between Task 2 and Task 4. `createClient`/`listClients` signatures match between the Interfaces block and the implementation. `@firebase/rules-unit-testing@^4.0.0` added once, in Task 4.
