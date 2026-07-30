import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { z } from "zod";
import { assertMember, auth, db } from "./admin.js";
import {
  DriveConfigurationError,
  driveOauthClientId,
  driveOauthClientSecret,
  driveTokenCipherKey,
  ensureFolderPath,
  listFilesInFolder,
  makeDriveFilePubliclyViewable,
} from "./drive.js";
import { accessLevelSchema, ownerTypeSchema, resolveDocumentFolder } from "./documentFolders.js";

const inputSchema = z.object({
  accessLevel: accessLevelSchema,
  ownerType: ownerTypeSchema,
  ownerId: z.string().min(1).max(256),
});

const allowedOrigins = new Set([
  "https://solvingclub-cw-management.web.app",
  "https://solvingclub-cw-management.firebaseapp.com",
  "http://localhost:5000",
  "http://localhost:5173",
]);

function applyCors(origin: string | undefined, response: { setHeader(name: string, value: string): void }) {
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
  }
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function statusForError(error: unknown): number {
  if (error instanceof HttpsError) {
    switch (error.code) {
      case "invalid-argument": return 400;
      case "unauthenticated": return 401;
      case "permission-denied": return 403;
      case "failed-precondition": return 412;
      case "unavailable": return 503;
      default: return 500;
    }
  }
  return 500;
}

async function syncDriveDocumentsForUser(uid: string, data: unknown): Promise<{ imported: number; skipped: number }> {
  await assertMember(uid);
  const parsed = inputSchema.safeParse(data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Invalid sync details.");
  const { accessLevel, ownerType, ownerId } = parsed.data;

  if (ownerType === "workspace" && accessLevel !== "internal") {
    throw new HttpsError("failed-precondition", "Workspace management files are internal only.");
  }

  try {
    const { names, clientId } = await resolveDocumentFolder(ownerType, ownerId);
    const folderId = await ensureFolderPath(names);
    const driveFiles = await listFilesInFolder(folderId);
    let imported = 0;
    let skipped = 0;

    for (const file of driveFiles) {
      const existing = await db.collection("documents").where("driveFileId", "==", file.id).limit(1).get();
      if (!existing.empty) {
        skipped += 1;
        continue;
      }

      await makeDriveFilePubliclyViewable(file.id).catch((error) => {
        console.warn("Drive public link permission failed during sync", {
          fileId: file.id,
          code: (error as { code?: number; response?: { status?: number } }).code
            ?? (error as { response?: { status?: number } }).response?.status,
          message: (error as { message?: string }).message,
        });
      });

      await db.collection("documents").add({
        kind: "managed",
        label: file.name,
        url: file.url,
        driveFileId: file.id,
        mimeType: file.mimeType,
        accessLevel,
        ownerType,
        ownerId,
        clientId,
        uploadedBy: uid,
        createdAt: Date.now(),
      });
      imported += 1;
    }

    return { imported, skipped };
  } catch (cause) {
    const error = cause as { code?: number; message?: string; response?: { status?: number } };
    console.error("Drive document sync failed", {
      ownerType, ownerId, code: error.code ?? error.response?.status, message: error.message,
    });
    if (cause instanceof HttpsError) throw cause;
    if (cause instanceof DriveConfigurationError) {
      throw new HttpsError("failed-precondition", "Google Drive storage is not configured yet. Connect Google Drive in CWMS storage settings first.");
    }
    throw new HttpsError("unavailable", "Drive sync is temporarily unavailable. Please try again.");
  }
}

export const syncDriveDocuments = onCall(
  { invoker: "public", secrets: [driveOauthClientId, driveOauthClientSecret, driveTokenCipherKey] },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required.");
    return syncDriveDocumentsForUser(request.auth.uid, request.data);
  },
);

export const syncDriveDocumentsHttp = onRequest(
  { invoker: "public", secrets: [driveOauthClientId, driveOauthClientSecret, driveTokenCipherKey] },
  async (request, response) => {
    applyCors(request.headers.origin, response);
    if (request.method === "OPTIONS") {
      response.status(204).send("");
      return;
    }
    if (request.method !== "POST") {
      response.status(405).json({ error: "method-not-allowed" });
      return;
    }

    try {
      const authHeader = request.headers.authorization;
      const match = authHeader?.match(/^Bearer (.+)$/);
      if (!match) throw new HttpsError("unauthenticated", "Sign in required.");
      const decoded = await auth.verifyIdToken(match[1]);
      const result = await syncDriveDocumentsForUser(decoded.uid, request.body);
      response.status(200).json(result);
    } catch (error) {
      const status = statusForError(error);
      const message = error instanceof HttpsError ? error.message : "Drive sync is temporarily unavailable. Please try again.";
      response.status(status).json({ error: message });
    }
  },
);
