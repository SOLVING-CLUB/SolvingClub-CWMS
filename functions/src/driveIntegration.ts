import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { z } from "zod";
import { assertOwnerOrAdmin, auth } from "./admin.js";
import {
  buildDriveIntegrationSummary,
  exchangeDriveCode,
  disconnectDrive,
  driveOauthClientId,
  driveOauthClientSecret,
  driveTokenCipherKey,
  updateDriveRootFolder,
} from "./drive.js";

const connectSchema = z.object({
  code: z.string().min(1).max(4096),
  redirectUri: z.string().url().max(1024),
  rootFolderId: z.string().trim().max(256).optional(),
});

const rootSchema = z.object({
  rootFolderId: z.string().min(1).max(256),
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
      default: return 500;
    }
  }
  return 500;
}

export const getDriveIntegration = onCall(
  { invoker: "public", secrets: [driveOauthClientId, driveOauthClientSecret, driveTokenCipherKey] },
  async (request) => {
    await assertOwnerOrAdmin(request.auth?.uid);
    const summary = await buildDriveIntegrationSummary();
    console.log("Drive integration summary", summary);
    return summary;
  },
);

export const connectGoogleDrive = onCall(
  { invoker: "public", secrets: [driveOauthClientId, driveOauthClientSecret, driveTokenCipherKey] },
  async (request) => {
    await assertOwnerOrAdmin(request.auth?.uid);
    const parsed = connectSchema.safeParse(request.data);
    if (!parsed.success) throw new HttpsError("invalid-argument", "Invalid Google Drive connection payload.");
    return exchangeDriveCode({
      code: parsed.data.code,
      redirectUri: parsed.data.redirectUri,
      rootFolderId: parsed.data.rootFolderId,
      connectedByUid: request.auth!.uid,
    });
  },
);

export const connectGoogleDriveHttp = onRequest(
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
      await assertOwnerOrAdmin(decoded.uid);

      const parsed = connectSchema.safeParse(request.body);
      if (!parsed.success) throw new HttpsError("invalid-argument", "Invalid Google Drive connection payload.");

      const summary = await exchangeDriveCode({
        code: parsed.data.code,
        redirectUri: parsed.data.redirectUri,
        rootFolderId: parsed.data.rootFolderId,
        connectedByUid: decoded.uid,
      });

      response.status(200).json(summary);
    } catch (error) {
      const status = statusForError(error);
      const message = error instanceof HttpsError ? error.message : "Google Drive could not be connected.";
      response.status(status).json({ error: message });
    }
  },
);

export const updateGoogleDriveRootFolder = onCall(
  { invoker: "public", secrets: [driveOauthClientId, driveOauthClientSecret, driveTokenCipherKey] },
  async (request) => {
    await assertOwnerOrAdmin(request.auth?.uid);
    const parsed = rootSchema.safeParse(request.data);
    if (!parsed.success) throw new HttpsError("invalid-argument", "Invalid Google Drive folder id.");
    return updateDriveRootFolder(parsed.data.rootFolderId);
  },
);

export const disconnectGoogleDrive = onCall(
  { invoker: "public", secrets: [driveOauthClientId, driveOauthClientSecret, driveTokenCipherKey] },
  async (request) => {
    await assertOwnerOrAdmin(request.auth?.uid);
    await disconnectDrive();
    return { ok: true };
  },
);
