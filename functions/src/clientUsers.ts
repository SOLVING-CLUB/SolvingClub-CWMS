import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { auth, db, assertOwnerOrAdmin } from "./admin.js";

const createSchema = z.object({
  clientId: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

/** Create a Firebase Auth login for a client, tagged with role=client + clientId. */
export const createClientUser = onCall(async (request) => {
  await assertOwnerOrAdmin(request.auth?.uid);

  const parsed = createSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Invalid client login details.");
  const { clientId, email, password } = parsed.data;

  const clientSnap = await db.doc(`clients/${clientId}`).get();
  if (!clientSnap.exists) throw new HttpsError("not-found", "Client does not exist.");

  let user;
  try {
    user = await auth.createUser({ email, password });
  } catch {
    throw new HttpsError("already-exists", "That email is already registered.");
  }
  await auth.setCustomUserClaims(user.uid, { role: "client", clientId });
  await db.doc(`clients/${clientId}`).set({ authUid: user.uid, loginEmail: email }, { merge: true });

  return { uid: user.uid };
});

const resetSchema = z.object({
  clientId: z.string().min(1),
  newPassword: z.string().min(6),
});

/** Reset a client's login password (owner/admin only). */
export const resetClientPassword = onCall(async (request) => {
  await assertOwnerOrAdmin(request.auth?.uid);

  const parsed = resetSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Invalid input.");

  const clientSnap = await db.doc(`clients/${parsed.data.clientId}`).get();
  const authUid = clientSnap.exists ? clientSnap.get("authUid") : undefined;
  if (!authUid) throw new HttpsError("not-found", "This client has no login yet.");

  await auth.updateUser(authUid, { password: parsed.data.newPassword });
  return { ok: true };
});
