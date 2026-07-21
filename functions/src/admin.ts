import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) initializeApp();

export const auth = getAuth();
export const db = getFirestore();

/** Throws unless the caller is a signed-in member with role owner or admin. */
export async function assertOwnerOrAdmin(uid: string | undefined): Promise<void> {
  const { HttpsError } = await import("firebase-functions/v2/https");
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const snap = await db.doc(`members/${uid}`).get();
  const role = snap.exists ? snap.get("role") : undefined;
  if (role !== "owner" && role !== "admin") {
    throw new HttpsError("permission-denied", "Only an owner or admin may do this.");
  }
}
