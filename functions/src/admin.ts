import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError } from "firebase-functions/v2/https";

if (getApps().length === 0) initializeApp();

export const auth = getAuth();
export const db = getFirestore();
export const storage = getStorage();

/** Throws unless the caller is a signed-in member with role owner or admin. */
export async function assertOwnerOrAdmin(uid: string | undefined): Promise<void> {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const snap = await db.doc(`members/${uid}`).get();
  const role = snap.exists ? snap.get("role") : undefined;
  if (role !== "owner" && role !== "admin") {
    throw new HttpsError("permission-denied", "Only an owner or admin may do this.");
  }
}

/** Throws unless the caller is a signed-in org member (any role). */
export async function assertMember(uid: string | undefined): Promise<void> {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const snap = await db.doc(`members/${uid}`).get();
  if (!snap.exists) throw new HttpsError("permission-denied", "Members only.");
}
