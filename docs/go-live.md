# Go-Live Checklist

Everything in this repo runs today against the local Firebase emulator. This
is what's left to run it against your real Firebase project.

## 1. Firebase project

- Confirm the project is on the **Blaze** (pay-as-you-go) plan. Cloud
  Functions require it. At boutique scale (a few members, ~50 clients),
  actual cost is close to $0 — Blaze still includes the same free tier as
  Spark, you only pay past it.
- In the Firebase Console, enable: **Authentication** (turn on the
  Email/Password sign-in provider), **Firestore**, **Storage**,
  **Functions**.
- In Google Cloud Console (same project), enable the **Google Drive API**.

## 2. Point the app at the real project

- `.firebaserc`: replace `demo-solvingclub` with your real project id.
- Firebase Console → Project settings → your web app → SDK config. Copy the
  values into `apps/web/.env`:
  ```
  VITE_FB_API_KEY=...
  VITE_FB_AUTH_DOMAIN=...
  VITE_FB_PROJECT_ID=...
  VITE_FB_APP_ID=...
  VITE_USE_EMULATOR=false
  ```

## 3. Deploy rules, functions, and hosting

```bash
pnpm -C packages/core build
pnpm -C functions build
pnpm -C apps/web build
firebase deploy --only firestore:rules,firestore:indexes,storage,functions,hosting --project <your-project-id>
```

## 4. Google Drive service account (for managed file uploads)

Linked documents (paste-a-URL) work with zero setup. Managed uploads (real
file → Drive) need a service account:

1. Google Cloud Console → IAM & Admin → Service Accounts → create one →
   generate a JSON key.
2. Set it as a Cloud Functions secret:
   ```bash
   firebase functions:secrets:set DRIVE_SA_KEY_JSON --project <your-project-id>
   ```
   (paste the full JSON file contents when prompted)
3. Optional but recommended — pre-create a folder in that service account's
   Drive, share it with your team's Gmail addresses, and set its folder id:
   ```bash
   firebase functions:secrets:set DRIVE_ROOT_FOLDER_ID --project <your-project-id>
   ```
   If you skip this, the function creates a folder called "SolvingClub CMS"
   in the service account's own Drive on first upload — you'll need to find
   it and share it with your team manually afterward.
4. Optional — auto-share every uploaded file with specific team members:
   ```bash
   firebase functions:secrets:set DRIVE_SHARE_WITH --project <your-project-id>
   ```
   (comma-separated emails)

## 5. Create the first owner

There's no self-serve sign-up — the first account is seeded by hand:

1. Firebase Console → Authentication → add a user (email + password).
2. Firestore Console → create a document at `members/<that user's uid>`:
   ```json
   { "uid": "<uid>", "name": "Your Name", "email": "you@…", "role": "owner", "status": "active", "createdAt": 1234567890 }
   ```
3. Sign in with that account — you now have full access and can invite
   other members the same way (or build a members-invite screen later).

## 6. Smoke test in production

- Sign in as the owner, create a client, create a project → app → task.
- On the client detail page, click "create login" to give the client an
  account; sign in as that client in a private/incognito window and confirm
  they see only their own data.
- Try both a linked document and (once the Drive secret is set) a real file
  upload.
- Generate an invoice and confirm the client can see it read-only.

## Known limitations (by design, not bugs)

- No self-serve signup for members or password reset flow for members
  (only client passwords are admin-managed).
- The web bundle is a single ~900KB chunk — fine at this scale; code-splitting
  is a later optimization, not a blocker.
- Notification bell polls every 30s rather than using a live listener —
  simple and sufficient at boutique scale.
