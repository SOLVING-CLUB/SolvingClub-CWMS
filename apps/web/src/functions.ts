import { httpsCallable } from "firebase/functions";
import { fb } from "./firebase";
import type { OwnerType, Document } from "@solvingclub/core";

export const createClientUser = httpsCallable<
  { clientId: string; email: string; password: string },
  { uid: string }
>(fb.functions, "createClientUser");

export const resetClientPassword = httpsCallable<
  { clientId: string; newPassword: string },
  { ok: boolean }
>(fb.functions, "resetClientPassword");

export const deleteProjectTree = httpsCallable<{ id: string }, { deleted: number }>(fb.functions, "deleteProjectTree");
export const deleteApplicationTree = httpsCallable<{ id: string }, { deleted: number }>(fb.functions, "deleteApplicationTree");
export const deleteTaskTree = httpsCallable<{ id: string }, { deleted: number }>(fb.functions, "deleteTaskTree");
export const deleteDocument = httpsCallable<{ id: string }, { ok: boolean }>(fb.functions, "deleteDocument");
export const createMemberUser = httpsCallable<{ name: string; email: string; password: string; role: "admin" | "member" }, { uid: string }>(fb.functions, "createMemberUser");
export const updateMemberUser = httpsCallable<{ uid: string; role?: "admin" | "member"; status?: "active" | "disabled" }, { ok: boolean }>(fb.functions, "updateMemberUser");

const uploadDocumentCallable = httpsCallable<
  { storagePath: string; fileName: string; mimeType: string; label: string; ownerType: OwnerType; ownerId: string },
  Document
>(fb.functions, "uploadDocument");

export async function uploadDocument(
  input: { storagePath: string; fileName: string; mimeType: string; label: string; ownerType: OwnerType; ownerId: string },
): Promise<Document> {
  const res = await uploadDocumentCallable(input);
  return res.data;
}
