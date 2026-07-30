# SolvingClub CWMS — Client & Work Management System

Boutique-scale client/delivery/billing system for SolvingClub. pnpm monorepo, Firebase
backend, single React SPA. Not multi-tenant: one workspace, one org, many clients.

> Deep architecture map: [docs/context/ARCHITECTURE.md](docs/context/ARCHITECTURE.md)
> What happened in past sessions: [docs/context/SESSION-LOG.md](docs/context/SESSION-LOG.md)
> Production ops & deploy: [docs/go-live.md](docs/go-live.md)

## Layout

| Path | What it is |
|---|---|
| `packages/core` | `@solvingclub/core` — zod models + all Firestore data-access + rules tests. Consumed as raw TS source (`main: ./src/index.ts`), not built output. |
| `apps/web` | `@solvingclub/web` — Vite + React 19 SPA, Tailwind v4, shadcn/ui on React Aria. |
| `functions` | `@solvingclub/functions` — Firebase Functions v2, Node 22 ESM (`.js` import specifiers required). |
| `firestore.rules` / `storage.rules` | The real authorization boundary. |

## Commands

```bash
pnpm test                  # firestore emulator + all package tests (needs Java 17+)
pnpm build                 # builds every package
pnpm -C packages/core build   # tsc only
pnpm -C apps/web build        # tsc --noEmit && vite build
pnpm -C functions build       # tsc
pnpm -C apps/web dev          # vite dev server (5173)
```

Deploy (see `docs/go-live.md` for the full sequence):
```bash
pnpm exec firebase deploy --only firestore:rules,firestore:indexes,storage,functions,hosting \
  --project solvingclub-cw-management
```

Firebase projects: `default` = `solvingclub-cw-management` (production — **the only** real
project; never create a substitute), `emulator` = `demo-solvingclub` (tests only).

## Roles — two separate auth models

Do not conflate these; they resolve differently and that is deliberate.

- **Members** (`owner` / `admin` / `member`) live in the `members/{uid}` doc. Rules re-read
  that doc on every request via `memberData()`, so a role or status change takes effect
  immediately with no token refresh. `status` must be `active`.
- **Clients** are identified only by custom claims: `role: "client"` + `clientId`. They never
  get a `members` doc. `App.tsx` routes them to `ClientPortal` *outside* the router.

Permission shape: owner-only = member management. owner/admin = clients, projects,
applications, documents, invoices, deletes. member = create tasks, edit only tasks where
`assigneeUid == uid`. client = read own data, reprioritize own tasks (`priority`/`order`
only), comment, read `accessLevel: "client"` documents.

## Rules invariants — keep these true

- Every write validator uses `keys().hasOnly([...])` + `hasAll([...])` so no extra field can
  be smuggled in. Add a field to a zod model ⇒ add it to the matching rules validator, or
  writes start failing (and vice versa: widening rules without the model is a hole).
- `validDocumentData()` branches on `kind`: `linked` must **not** carry `driveFileId`/`mimeType`;
  `managed` must carry both.
- Documents can only be created by owner/admin with `uploadedBy == request.auth.uid`, and
  `validDocumentOwner()` verifies the owner entity exists and its `clientId` matches.
- Clients read a document only when `accessLevel == 'client'`.
- Task/application creation checks ancestor `status == 'active'`, so archiving a project
  stops new work under it.
- `staging/{uid}/{uploadId}` in Storage: write-only, `read: if false`, `uploadId` pinned to a
  UUID regex. Only Admin-SDK functions read staged bytes.

## Conventions

- Timestamps are plain `number` (`Date.now()`), never Firestore `Timestamp`.
- Absent optional fields are **omitted**, never written as `null` (rules validators reject
  the wrong type, and `null` breaks zod `.optional()`).
- Every model has a zod schema + `parseX()` in `packages/core/src/models/`, and data-access
  in `packages/core/src/firebase/` (`subscribeX` for live listeners, `listX` for one-shot).
- Web route components are `lazy()`-imported in `App.tsx` and export both a named and a
  default export. Firebase SDKs are manually chunked — keep them that way.
- Destructive operations (delete project/application/task/document) go through callable
  functions, never client-side, so descendants and Drive files are removed together.
- Notification bell polls every 30s on purpose; it is not a live listener.
- Functions are ESM: intra-package imports must end in `.js` even though sources are `.ts`.
- Emulator rules tests run with `fileParallelism: false` — the emulator is shared state.

## Working agreements

- Default loop for any feature: **build it → run `pnpm build` and `pnpm test` → deploy it.**
  "Run the tests" means the suite that already exists. Do not stand up new test
  infrastructure or backfill coverage for adjacent features unless asked.
- Rules changes should come with a matching test in `packages/core/src/firebase/*.test.ts`.
- Commit style: `type(scope): imperative summary`, and when a fix had a non-obvious cause,
  state the root cause in the message (see `git log` for the established pattern).
- **Never** put `Co-Authored-By:` trailers, or any AI/assistant/Claude mention, in commit
  messages or PR bodies. No "generated with" footers. The history is the team's own record.
- Append a session entry to `docs/context/SESSION-LOG.md` before finishing substantive work.
- `apps/web/.env` holds real production config and is gitignored — never print, commit, or
  overwrite it. Mirror new keys into `.env.example` empty.
