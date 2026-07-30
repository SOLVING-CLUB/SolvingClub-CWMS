import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { assertOwnerOrAdmin, db } from "./admin.js";
import { deleteDriveFile, driveOauthClientId, driveOauthClientSecret, driveTokenCipherKey } from "./drive.js";

const schema = z.object({ id: z.string().min(1).max(200) });

export const deleteDocument = onCall({ invoker: "public", secrets: [driveOauthClientId, driveOauthClientSecret, driveTokenCipherKey] }, async (request) => {
  await assertOwnerOrAdmin(request.auth?.uid);
  const parsed = schema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Invalid document id.");
  const ref = db.doc(`documents/${parsed.data.id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Document not found.");
  const driveFileId = snap.get("driveFileId") as string | undefined;
  if (driveFileId) await deleteDriveFile(driveFileId);
  await ref.delete();
  return { ok: true };
});
