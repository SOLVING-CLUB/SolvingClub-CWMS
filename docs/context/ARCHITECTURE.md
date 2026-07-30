# CWMS Architecture Map

Reference map so a new session can act without re-reading the whole tree.
Last verified against the working tree on **2026-07-30** (branch `foundation`).
If a detail here contradicts the code, the code wins — fix this file.

## 1. Domain hierarchy

```
Client ──┬── Project ──── Application ──── Task ──── Comment
         ├── Invoice
         └── Document (may attach at any level below)

Document.ownerType ∈ workspace | client | project | application | task
```

Every level below Client denormalizes `clientId` onto itself. This is load-bearing: rules
authorize a client's read with `ownsClient(resource.data.clientId)` on a single doc read,
with no joins. **Never drop `clientId` from a descendant model.**

`ownerType: "workspace"` is the internal ops vault and uses the sentinel
`ownerId == clientId == "__workspace__"`, forced to `accessLevel: "internal"` by rules.

## 2. Firestore collections

All flat top-level collections (no subcollections anywhere).

| Collection | Doc id | Notes |
|---|---|---|
| `members/{uid}` | auth uid | Source of truth for member role/status. Read on every rules eval. |
| `clients/{id}` | auto | `authUid`/`loginEmail` set when a client login is provisioned. |
| `projects/{id}` | auto | |
| `applications/{id}` | auto | `projectId` + `clientId` |
| `tasks/{id}` | auto | `applicationId` + `projectId` + `clientId`, `priority` 1–5, `order` float |
| `comments/{id}` | auto | `authorType` ∈ member \| client |
| `documents/{id}` | auto | `kind` ∈ managed \| linked; `accessLevel` ∈ internal \| client |
| `notifications/{id}` | auto | `recipientType` ∈ member \| client; `recipientId` may be sentinel `"org"` = all members |
| `invoices/{id}` | auto | `number` matches `INV-\d{4,}`, `total` recomputed from `lineItems` |
| `counters/{id}` | fixed | Sequential invoice numbering. owner/admin only. |
| `integrations/googleDriveDefault` | fixed | Drive OAuth connection state + encrypted refresh token. |

## 3. Auth & session resolution (`apps/web/src/App.tsx`)

```
onAuthStateChanged
 ├─ token.claims.role === "client"  → Session{role:"client", clientId} → <ClientPortal/>  (no router)
 └─ otherwise                       → getMember(db, uid)
                                      ├─ missing or status !== "active" → <AccessDenied/>
                                      └─ Session{role} → <RouterProvider/>
 └─ any throw → fail closed to AccessDenied (user can still sign out)
```

`useSession()` + `canAdmin(role)` from `apps/web/src/auth/SessionContext.tsx` gate UI.
UI gating is cosmetic — rules are the real boundary.

## 4. Routes (all lazy, inside `<Shell/>`)

| Path | Component |
|---|---|
| `/` | `OverviewPage` — dashboard, attention queue, workspace vault |
| `/clients`, `/clients/:clientId` | `ClientsPage`, `ClientDetailPage` |
| `/clients/:clientId/apps/:applicationId` | `TasksPage` |
| `/projects`, `/projects/:projectId` | `ProjectsPage`, `ProjectDetailPage` |
| `/applications`, `/applications/:clientId/:applicationId` | `ApplicationsPage`, `TasksPage` |
| `/work` | `WorkspaceTasksPage` — cross-client "all work" |
| `/members` | `MembersPage` (owner-only actions) |
| `/storage` | `StoragePage` — Google Drive connection (owner/admin) |

Client-facing surface is only `ClientPortal` + `ClientSharedDocuments`; it has no routes.

## 5. Cloud Functions (`functions/src/index.ts`)

Callables (all `invoker: "public"` — required so browser CORS preflight reaches Firebase's
own callable auth; authorization happens inside via `assertOwnerOrAdmin` / `assertMember`):

| Function | Guard | Purpose |
|---|---|---|
| `createClientUser`, `resetClientPassword` | owner/admin | provision client auth + `role`/`clientId` claims |
| `createMemberUser`, `updateMemberUser` | owner | team accounts, role/status |
| `uploadDocument` | member | Storage-staged bytes → Drive → `documents` record |
| `syncDriveDocuments` (+ `…Http`) | member | import existing Drive folder files as documents |
| `getDriveIntegration`, `connectGoogleDrive` (+ `…Http`), `updateGoogleDriveRootFolder`, `disconnectGoogleDrive` | owner/admin | Drive OAuth lifecycle |
| `deleteProjectTree`, `deleteApplicationTree`, `deleteTaskTree`, `deleteDocument` | owner/admin | cascade delete incl. Drive files |

Firestore triggers in `notifications.ts`: `onTaskCreated`, `onTaskAssigneeChanged`,
`onTaskStatusChanged`, `onInvoiceStatusChanged`, `onCommentCreated`.

**Why the `…Http` twins exist:** the `onCall` variants hit CORS/preflight trouble in
production for the Drive paths, so `connectGoogleDriveHttp` / `syncDriveDocumentsHttp` are
`onRequest` versions with a hand-written origin allowlist and `Bearer <idToken>` verified via
`auth.verifyIdToken`. The web client calls the **Http** ones for connect + sync (see
`apps/web/src/functions.ts`, which hardcodes
`https://us-central1-solvingclub-cw-management.cloudfunctions.net/...`).
That hardcoded host means these two paths do **not** work against the emulator.

Auth helpers live in `functions/src/admin.ts`: `assertOwner`, `assertOwnerOrAdmin`,
`assertMember`. Admin SDK bypasses all security rules — every function must assert first.

## 6. Google Drive integration (`functions/src/drive.ts`)

Current mode is **personal OAuth** (`mode: "personal_oauth"`), not a service account.

- An owner/admin authorizes via Google Identity Services popup (`initCodeClient`,
  `access_type: offline`, `prompt: consent`) in `StoragePage.tsx`; the auth code goes to
  `connectGoogleDriveHttp`, which exchanges it and stores the **refresh token encrypted with
  AES-256-GCM** (`iv.authTag.ciphertext`, base64, dot-joined) in
  `integrations/googleDriveDefault`.
- Secrets (Secret Manager): `GOOGLE_DRIVE_OAUTH_CLIENT_ID`,
  `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET`, `GOOGLE_DRIVE_TOKEN_CIPHER_KEY`.
  Web needs `VITE_GOOGLE_DRIVE_CLIENT_ID`. `DriveConfigurationError` → surfaced as
  `failed-precondition` with a "connect Drive first" message.
- Folder layout, derived in `documentFolders.ts::resolveDocumentFolder`, created lazily by
  `ensureFolderPath`:
  ```
  <root>/SolvingClub Management                                      (workspace)
  <root>/Clients/<Client>                                            (client)
  <root>/Clients/<Client>/Projects/<Project>                         (project)
  <root>/Clients/<Client>/Projects/<P>/Applications/<App>            (application)
  <root>/Clients/<Client>/Projects/<P>/Applications/<A>/Tasks/<Task> (task)
  ```
  Folders are matched by **name**, so renaming a client/project orphans its old folder
  (existing documents keep working — they store `driveFileId` + URL).
- Uploaded files are made `anyone: reader` so stored `webViewLink`s open for clients; that
  permission call is best-effort and only warns on failure.

Managed-upload flow: browser → Storage `staging/{uid}/{uuid}` → `uploadDocument` callable →
Admin SDK reads bytes → Drive upload → `documents` record → staged object deleted.

## 7. Frontend stack notes

- React 19, `react-router-dom` v7, Tailwind **v4** via `@tailwindcss/vite` (no
  `tailwind.config.js`; tokens live in `apps/web/src/styles/global.css`).
- shadcn/ui components in `apps/web/src/components/ui/` are built on **React Aria
  Components**, not Radix. Buttons take `onPress` / `isDisabled`, not `onClick` / `disabled`.
- `@/` alias → `apps/web/src/` (see `vite.config.ts`, `components.json`).
- Manual chunks split `react`, `react-aria`, and each Firebase SDK. Route bundles stay
  ~8–17 kB; `firebase-firestore` (~315 kB) dominates and is expected.
- Global CSS uses semantic classnames (`content-stack`, `document-row`, `storage-stat`,
  `data-error`, `data-success`) alongside Tailwind utilities. Match the local idiom per file.

## 8. Testing

- `packages/core/src/firebase/*.test.ts` run against the Firestore emulator through
  `@firebase/rules-unit-testing`, **as an authenticated member under the real rules** — they
  are the rules test suite as much as the data-access suite.
- `rules.test.ts` / `clientRules.test.ts` assert denials; expected `PERMISSION_DENIED` noise
  in output is normal.
- `vitest.config.ts` sets `fileParallelism: false` — the emulator is shared state and
  parallel files race.
- `apps/web` has only `src/lib/workspace.test.ts` (pure helpers). No component tests.
- `functions` runs `vitest --passWithNoTests`; `uploadStaging.test.ts` covers the staging
  path guard.

## 9. Known drift / rough edges

- `docs/go-live.md` §4 still documents the **old service-account** Drive setup
  (`DRIVE_SA_KEY_JSON`, `DRIVE_ROOT_FOLDER_ID`, `DRIVE_SHARE_WITH`). The code has moved to
  personal OAuth with three different secrets. Update that section when the Drive work lands.
- `apps/web/src/functions.ts` hardcodes the production Functions host for the two Http
  endpoints — no emulator support, no project indirection.
- `firestore.indexes.json` is empty (`{}`); composite-index needs are unmet and would show up
  as runtime query failures in production.
- `firestore-debug.log` (~128 KB) sits untracked in the repo root; emulator leftover.
- No CI workflow — `pnpm test` / `pnpm build` are manual gates.
