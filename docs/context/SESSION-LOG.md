# Session Log

Append-only ledger of working sessions. **Newest entry on top.** Read the top 2–3 entries at
the start of a session; that plus `CLAUDE.md` and `ARCHITECTURE.md` should be enough to
resume without re-exploring.

Keep entries short. Record what a future session cannot recover from `git log` or the code:
in-flight intent, why something was done, what was decided against, what's still unproven.

Template:

```md
## YYYY-MM-DD — <short title>
**State:** branch, build/test result, clean or dirty tree
**Did:** 1–4 bullets
**Decided:** non-obvious choices and why (omit if none)
**Next:** concrete next actions
**Open:** unresolved questions / unverified assumptions
```

---

## 2026-07-30 — Project mapped; persistent context system established
**State:** branch `foundation`, ahead of `main`. Tree **dirty** with a large uncommitted
feature (below). Verified this session: `packages/core`, `functions`, `apps/web` all build
clean; `pnpm test` → 15 files / 62 core tests + 3 web tests, all passing.

**Did:**
- Full read-through of the monorepo: models, data-access, rules, functions, routes, Drive
  integration, build/test setup.
- Wrote `CLAUDE.md`, `docs/context/ARCHITECTURE.md`, and this log.
- Seeded durable memory notes under the Claude project memory dir (indexed in its `MEMORY.md`).

**In-flight uncommitted work — Google Drive "personal OAuth" storage + workspace vault**
(~1200 insertions across 32 files). Coherent and building, but **not committed and not
end-to-end verified against production Drive**. Composed of:
- `functions/src/drive.ts` rewritten: service-account → personal-OAuth refresh token,
  AES-256-GCM encrypted in `integrations/googleDriveDefault`.
- New `functions/src/driveIntegration.ts` (connect/disconnect/root-folder/status),
  `syncDriveDocuments.ts` (import existing Drive files), `documentFolders.ts` (folder-path
  resolution), `uploadStaging.ts` + its test (staging-path guard).
- New `apps/web/src/storage/StoragePage.tsx` (`/storage`) driving the Google Identity
  Services popup; `ui/DeliveryTabs.tsx`; `documents/ClientSharedDocuments.tsx`.
- Rules hardening: `validDocumentData()` with `hasOnly`/`hasAll` + `kind` branching;
  `workspace` sentinel owner; clients can now read documents **only** when
  `accessLevel == 'client'`; task/application creation requires ancestor `status == 'active'`;
  Storage staging filename pinned to a UUID regex.
- `firebase.json` gained security headers on hosting.

**Decided:**
- Recorded architecture in-repo (`docs/context/`) rather than only in Claude memory, so the
  knowledge survives for the human team and any tool, not just one assistant.

**Next:**
1. Decide whether the Drive/vault work gets committed as one feature commit or split
   (functions / rules+tests / web) — split reads better in review.
2. Add rules tests for the new `workspace` owner type and the
   `accessLevel == 'client'` client-read restriction before committing. The existing suite
   passes but predates these branches, so they're currently untested.
3. Update `docs/go-live.md` §4 — it still documents the retired service-account secrets.
4. Smoke-test connect → upload → sync → client-portal visibility against real Drive.

**Open:**
- Was the service-account → personal-OAuth switch a deliberate product decision, or a
  workaround for Drive quota/sharing friction? Affects whether §4 gets rewritten or deleted.
- `firestore.indexes.json` is empty; unknown whether production queries need composite
  indexes yet.
- ⚠️ `.claude/settings.local.json` contains what looks like a real Firebase CLI refresh token
  in an `export FIREBASE_TOKEN=...` allow-rule. Confirmed never committed, and ignored via the
  *global* gitignore rather than this repo's. Flagged 2026-07-30; awaiting a decision to
  revoke the token, drop those allow-rules, and add the path to the repo `.gitignore` so a
  teammate without that global config is also covered.
