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
