# SolvingClub Client Management System — Foundation Design

**Date:** 2026-07-21
**Status:** Approved design (pending user review of this file)
**Scope of this spec:** Phase 0 (Foundation) + Phase 1 (Tasks) + Phase 2 (Documents/Drive) + client login & comments.

---

## 1. Goal

A web app for the SolvingClub freelance org to manage:
`Clients → Projects → Applications → Tasks`, with documents, org members, and client logins.

Firebase-backed. Built web-first, with a shared core so a future mobile app (Expo) reuses the logic.

## 2. Scale

Boutique: ~2–10 members, ~50 clients, hundreds of tasks. Firebase free/low tier.

## 3. Phasing

This spec builds:
- **Phase 0 — Foundation:** auth, org, members, roles, the full data model, security rules.
- **Phase 1 — Tasks:** manage clients/projects/apps/tasks; task board.
- **Phase 2 — Documents:** Drive folder tree + uploads (with linked-file fallback).
- **Client access:** client login, scoped read, reprioritize, comments.

Later specs (data hooks in place now, not built here):
- Notifications
- Invoicing & payments
- Native mobile app (Expo)

## 4. Tech stack

- **Backend:** existing Firebase project — Auth, Firestore, Cloud Functions (Node + TS), Firebase Storage (upload staging).
- **Frontend:** React + Vite + TypeScript, on Firebase Hosting.
- **Shared:** `packages/core` — framework-agnostic TS (models, data access, logic).
- **Drive:** Google service account (owns files, shares with team). All Drive writes happen in Cloud Functions.
- **Tooling:** pnpm monorepo, Firebase emulator for local dev, Vitest for tests.

## 5. Repo structure

```
Monorepo (pnpm workspaces)
├── packages/core
│     ├── models/   Zod schemas + TS types
│     ├── firebase/ Firestore data-access functions
│     └── logic/    validation, permission checks, priority/order rules
├── apps/web        React + Vite + TS (UI only, consumes core)
└── functions       Cloud Functions (Node + TS)
      └── drive/     create folder tree, move staged file → Drive, manage client auth users
```

Future `apps/mobile` (Expo) slots in beside `apps/web`, importing the same `packages/core`.

## 6. Architecture / runtime flow

- **Reads + simple writes** (tasks, clients, statuses, comments): web app → Firestore directly, guarded by security rules. Real-time.
- **Privileged ops** (Drive folder creation, file upload, creating client auth users): web app → **Callable Cloud Function** → Admin SDK / service account. Secrets live only in the function environment.
- **File upload path:** browser → Firebase Storage staging path → Cloud Function moves bytes to Drive via service account → writes `documents` doc → deletes staged file.
- **Linked-document path:** browser writes the `documents` doc directly (URL + label). No function needed. This is also the fallback if the Drive service-account path is ever unavailable.

## 7. Data model (Firestore)

Flat collections with reference IDs. Every project/app/task/document/comment carries `clientId`.

| Collection | Key fields |
|---|---|
| `members` | uid, name, email, role (`owner`/`admin`/`member`), status, createdAt |
| `clients` | name, email, phone, driveFolderId, status, createdAt |
| `projects` | clientId, name, description, status, driveFolderId, createdAt |
| `applications` | projectId, clientId, name, type, description, driveFolderId, status |
| `tasks` | applicationId, projectId, clientId, title, description, status, priority, order, assigneeUid, dueDate, createdBy, createdAt |
| `documents` | kind (`managed`/`linked`), label, url, driveFileId, mimeType, ownerType (`client`/`project`/`application`/`task`), ownerId, clientId, uploadedBy, createdAt |
| `comments` | taskId, clientId, authorUid, authorType (`member`/`client`), body, createdAt |

Enums:
- Role: `owner`, `admin`, `member` (and client users via custom claim, see §8).
- Task status: `todo`, `in_progress`, `blocked`, `done`.
- Task priority: ordered enum or numeric rank used for client reprioritization.

## 8. Auth & users

Two user types, both Firebase Auth:

**Members (org team)**
- Email/password.
- Owner seeded manually first.
- Owner/admin invites members; first login creates their `members` doc with role.

**Clients**
- Org admin creates the client login via a Cloud Function (Admin SDK): sets email + password.
- Org can reset a client password the same way.
- Client gets custom claims `role: client` + `clientId`.

## 9. Access model

**Members**
- `owner`: full access + manages members.
- `admin`: full access to clients/projects/apps/tasks/docs/comments; no member management.
- `member`: reads everything; creates tasks; edits tasks assigned to them; comments.

**Clients** (custom claim `role: client`, `clientId`)
- Read only their own tree (records where `clientId` == their claim).
- Reprioritize their own tasks (change `priority`/`order` only — not title/status).
- Comment on their own tasks.
- No create/delete of clients/projects/apps/tasks.

Enforced in Firestore security rules using the `clientId` field + custom claims. Cloud Functions use Admin SDK (bypass rules) for privileged writes.

## 10. Features in this build

- CRUD: clients → projects → applications → tasks.
- Task board: filter by client/project/app/assignee/status; sort by priority + due date.
- Documents attach to any level (`ownerType` + `ownerId`): upload a file (→ Drive) or paste a link.
- On creating a client/project/app, a Cloud Function creates its Drive folder under the parent, tree shape: `/Clients/<Client>/<Project>/<Application>/`.
- Client portal (scoped): view tree, reprioritize tasks, comment.

## 11. Error handling

- Drive/service-account failure: uploads surface a clear error; linked-document mode remains available as fallback.
- Cloud Function failures return typed errors to the UI; staged files cleaned up on failure.
- Security-rule denials handled with user-friendly messaging.

## 12. Testing

- `packages/core`: Vitest unit tests for logic + validation.
- Security rules: Firebase emulator tests (member vs client access, cross-client isolation).
- Cloud Functions: emulator tests for Drive folder creation, upload flow, client-user creation.

## 13. Out of scope (this spec)

Notifications, invoicing/payments, native mobile app. Data model already carries the hooks (`clientId` everywhere) so these are additive later.
