import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { db, storage, assertMember } from "./admin.js";
import { accessLevelSchema, ownerTypeSchema, resolveDocumentFolder } from "./documentFolders.js";
import {
  DriveConfigurationError,
  ensureFolderPath,
  uploadFile,
  driveOauthClientId,
  driveOauthClientSecret,
  driveTokenCipherKey,
} from "./drive.js";
import { isOwnedStagingPath } from "./uploadStaging.js";

const inputSchema = z.object({
  storagePath: z.string().min(1).max(512),
  fileName: z.string().min(1).max(240),
  mimeType: z.string().min(1).max(255),
  label: z.string().min(1).max(240),
  accessLevel: accessLevelSchema,
  ownerType: ownerTypeSchema,
  ownerId: z.string().min(1).max(256),
});

/**
 * Moves a member's staged upload (Firebase Storage) into the org's Drive
 * folder tree, then records it as a `managed` document. Deletes the staged
 * file whether the Drive upload succeeds or fails, so nothing is orphaned
 * in staging.
 */
export const uploadDocument = onCall(
  { invoker: "public", secrets: [driveOauthClientId, driveOauthClientSecret, driveTokenCipherKey] },
  async (request) => {
    await assertMember(request.auth?.uid);
    const uid = request.auth!.uid;

    const parsed = inputSchema.safeParse(request.data);
    if (!parsed.success) throw new HttpsError("invalid-argument", "Invalid upload details.");
    const { storagePath, fileName, mimeType, label, accessLevel, ownerType, ownerId } = parsed.data;

    if (!isOwnedStagingPath(uid, storagePath)) {
      throw new HttpsError("permission-denied", "You may only finalize your own staged upload.");
    }

    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) throw new HttpsError("not-found", "Staged file not found — upload may have failed.");

    try {
      const { names, clientId } = await resolveDocumentFolder(ownerType, ownerId);
      if (ownerType === "workspace" && accessLevel !== "internal") {
        throw new HttpsError("failed-precondition", "Workspace management files are internal only.");
      }
      const folderId = await ensureFolderPath(names);
      const [content] = await file.download();
      const { id: driveFileId, url } = await uploadFile({
        folderId,
        fileName,
        mimeType,
        content,
      });

      const createdAt = Date.now();
      const docRef = await db.collection("documents").add({
        kind: "managed", label, url, driveFileId, mimeType,
        accessLevel,
        ownerType, ownerId, clientId, uploadedBy: uid, createdAt,
      });

      return {
        id: docRef.id, kind: "managed", label, url, driveFileId, mimeType,
        accessLevel,
        ownerType, ownerId, clientId, uploadedBy: uid, createdAt,
      };
    } catch (cause) {
      const error = cause as { code?: number; message?: string; response?: { status?: number } };
      console.error("Managed Drive upload failed", {
        ownerType, ownerId, code: error.code ?? error.response?.status, message: error.message,
      });
      if (cause instanceof HttpsError) throw cause;
      if (cause instanceof DriveConfigurationError) {
        throw new HttpsError("failed-precondition", "Google Drive storage is not configured yet. Connect a Google Drive account in CWMS storage settings or attach a link instead.");
      }
      if (error.code === 403 || error.code === 404 || error.response?.status === 403 || error.response?.status === 404) {
        throw new HttpsError("failed-precondition", "The managed Drive folder is not accessible to CWMS. Reconnect Google Drive or check the selected folder.");
      }
      throw new HttpsError("unavailable", "Managed Drive is temporarily unavailable. Please try again or attach a link.");
    } finally {
      await file.delete().catch((err) => console.warn(`Failed to remove staged file ${storagePath}:`, err));
    }
  },
);
