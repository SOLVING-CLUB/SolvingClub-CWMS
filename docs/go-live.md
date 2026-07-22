# Production Operations

This repository is connected to and deployed on the existing Firebase project
`solvingclub-cw-management`. Use this guide for future production releases and
smoke checks; do not create or substitute another Firebase project.

## 1. Production services

- Authentication, Firestore, Storage, Functions, Hosting, and the Google Drive
  API are already enabled.
- The default Storage bucket is
  `solvingclub-cw-management.firebasestorage.app` in `US-CENTRAL1`.
- Cloud Functions run on Node.js 22 in `us-central1`.
- Callable Functions explicitly use a public infrastructure invoker so browser
  CORS preflights can reach Firebase's callable authentication and role checks.
- The `gcf-artifacts` repository keeps the three newest builds per package and
  removes artifacts older than seven days.

## 2. Production configuration

- `.firebaserc` already maps `default` to `solvingclub-cw-management` and
  reserves `demo-solvingclub` for emulator tests.
- `apps/web/.env` contains the production web-app configuration and is ignored
  by Git. Preserve it when cloning or rotating credentials:
  ```
  VITE_FB_API_KEY=...
  VITE_FB_AUTH_DOMAIN=...
  VITE_FB_PROJECT_ID=...
  VITE_FB_APP_ID=...
  VITE_FB_STORAGE_BUCKET=solvingclub-cw-management.firebasestorage.app
  VITE_USE_EMULATOR=false
  ```

## 3. Deploy rules, functions, and hosting

```bash
pnpm -C packages/core build
pnpm -C functions build
pnpm -C apps/web build
pnpm exec firebase deploy --only firestore:rules,firestore:indexes,storage,functions,hosting --project solvingclub-cw-management
```

## 4. Google Drive service account

`DRIVE_SA_KEY_JSON` is configured in Secret Manager. Managed uploads stage in
Firebase Storage and are transferred to Drive by Cloud Functions. If the
service account is rotated, replace the secret and redeploy Functions:

1. Generate the replacement JSON key in Google Cloud IAM.
2. Replace the Cloud Functions secret:
   ```bash
   pnpm exec firebase functions:secrets:set DRIVE_SA_KEY_JSON --project solvingclub-cw-management
   ```
   (paste the full JSON file contents when prompted)
3. Optional — pre-create a folder in that service account's
   Drive, share it with your team's Gmail addresses, and set its folder id:
   ```bash
   pnpm exec firebase functions:secrets:set DRIVE_ROOT_FOLDER_ID --project solvingclub-cw-management
   ```
   If you skip this, the function creates a folder called "SolvingClub CMS"
   in the service account's own Drive on first upload — you'll need to find
   it and share it with your team manually afterward.
4. Optional — auto-share every uploaded file with specific team members:
   ```bash
   pnpm exec firebase functions:secrets:set DRIVE_SHARE_WITH --project solvingclub-cw-management
   ```
   (comma-separated emails)

## 5. Team access

There is no public self-serve signup. Existing owners manage team accounts in
the **Members** area. Only use the manual recovery process below if every owner
account is unavailable:

1. Firebase Console → Authentication → add a user (email + password).
2. Firestore Console → create a document at `members/<that user's uid>`:
   ```json
   { "uid": "<uid>", "name": "Your Name", "email": "you@…", "role": "owner", "status": "active", "createdAt": 1234567890 }
   ```
3. Sign in with that account, then use **Members** to create admin and member
   accounts, change roles, or disable access.

## 6. Smoke test in production

- Run `pnpm test` and `pnpm build` locally first. Cloud Functions targets
  Node.js 22, the supported production runtime used by this project.
- Sign in as the owner, create a client, create a project → app → task.
- Create one admin and one regular member. Confirm the regular member can
  edit work assigned to them but cannot manage clients, billing, or members.
- On the client detail page, click "create login" to give the client an
  account; sign in as that client in a private/incognito window and confirm
  they see only their own data.
- Try both a linked document and (once the Drive secret is set) a real file
  upload.
- Generate an invoice and confirm the client can see it read-only.

## Operating notes

- There is intentionally no public self-serve signup. Owners provision team
  accounts; signed-in users can request Firebase password-reset email from
  the login screen.
- Routes and Firebase services are code-split to keep the initial workspace
  load focused. Re-run `pnpm build` after dependency upgrades to watch bundle
  sizes.
- Notification bell polls every 30s rather than using a live listener —
  predictable and sufficient at boutique scale.
- Deleting projects, applications, tasks, or managed documents uses callable
  server functions so descendants and Drive files are removed together.
