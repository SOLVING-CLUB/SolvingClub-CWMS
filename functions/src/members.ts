import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { assertOwner, auth, db } from "./admin.js";

const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(["admin", "member"]),
});

export const createMemberUser = onCall({ invoker: "public" }, async (request) => {
  await assertOwner(request.auth?.uid);
  const parsed = createSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Enter a valid name, email, password, and role.");
  const { name, email, password, role } = parsed.data;
  let user;
  try { user = await auth.createUser({ displayName: name, email, password, emailVerified: false }); }
  catch (error: unknown) {
    const code = (error as { code?: string }).code;
    if (code === "auth/email-already-exists") throw new HttpsError("already-exists", "That email is already registered.");
    throw new HttpsError("internal", "The member account could not be created.");
  }
  try {
    await db.doc(`members/${user.uid}`).set({ uid: user.uid, name, email, role, status: "active", createdAt: Date.now() });
  } catch {
    await auth.deleteUser(user.uid).catch(() => undefined);
    throw new HttpsError("internal", "The member account could not be saved.");
  }
  return { uid: user.uid };
});

const updateSchema = z.object({
  uid: z.string().min(1),
  role: z.enum(["admin", "member"]).optional(),
  status: z.enum(["active", "disabled"]).optional(),
}).refine((value) => value.role || value.status, "No update supplied");

export const updateMemberUser = onCall({ invoker: "public" }, async (request) => {
  await assertOwner(request.auth?.uid);
  const parsed = updateSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Invalid member update.");
  if (parsed.data.uid === request.auth?.uid) throw new HttpsError("failed-precondition", "You cannot change your own owner access here.");
  const ref = db.doc(`members/${parsed.data.uid}`);
  const member = await ref.get();
  if (!member.exists) throw new HttpsError("not-found", "Member not found.");
  if (member.get("role") === "owner") throw new HttpsError("failed-precondition", "Owner accounts cannot be changed here.");
  const patch = { ...(parsed.data.role && { role: parsed.data.role }), ...(parsed.data.status && { status: parsed.data.status }) };
  const wasDisabled = member.get("status") === "disabled";
  if (parsed.data.status) {
    try { await auth.updateUser(parsed.data.uid, { disabled: parsed.data.status === "disabled" }); }
    catch { throw new HttpsError("internal", "Authentication access could not be updated."); }
  }
  try {
    await ref.update(patch);
  } catch {
    // Keep Auth and Firestore aligned if the profile write fails after an Auth status change.
    if (parsed.data.status) await auth.updateUser(parsed.data.uid, { disabled: wasDisabled }).catch(() => undefined);
    throw new HttpsError("internal", "The member profile could not be updated.");
  }
  return { ok: true };
});
