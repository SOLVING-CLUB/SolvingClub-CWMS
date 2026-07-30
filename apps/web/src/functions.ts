import { httpsCallable } from "firebase/functions";
import { fb } from "./firebase";
import type { Document, DocumentAccessLevel, OwnerType } from "@solvingclub/core";

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
  {
    storagePath: string;
    fileName: string;
    mimeType: string;
    label: string;
    accessLevel: DocumentAccessLevel;
    ownerType: OwnerType;
    ownerId: string;
  },
  Document
>(fb.functions, "uploadDocument");
export async function uploadDocument(
  input: {
    storagePath: string;
    fileName: string;
    mimeType: string;
    label: string;
    accessLevel: DocumentAccessLevel;
    ownerType: OwnerType;
    ownerId: string;
  },
): Promise<Document> {
  const res = await uploadDocumentCallable(input);
  return res.data;
}

export async function syncDriveDocuments(input: {
  accessLevel: DocumentAccessLevel;
  ownerType: OwnerType;
  ownerId: string;
}): Promise<{ imported: number; skipped: number }> {
  const idToken = await fb.auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Sign in required.");
  const response = await fetch("https://us-central1-solvingclub-cw-management.cloudfunctions.net/syncDriveDocumentsHttp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null) as { imported: number; skipped: number } | { error?: string } | null;
  if (!response.ok) {
    throw new Error(payload && typeof payload === "object" && "error" in payload && payload.error ? payload.error : "Drive sync is temporarily unavailable. Please try again.");
  }
  return payload as { imported: number; skipped: number };
}

export type DriveIntegrationSummary = {
  status: "missing" | "active";
  mode: "personal_oauth" | null;
  connectedEmail: string | null;
  connectedAt: number | null;
  rootFolderId: string | null;
  rootFolderName: string | null;
  rootFolderUrl: string | null;
  requiredConfig: {
    webClientId: boolean;
    webClientSecret: boolean;
    tokenCipherKey: boolean;
  };
};

const getDriveIntegrationCallable = httpsCallable<Record<string, never>, DriveIntegrationSummary>(
  fb.functions,
  "getDriveIntegration",
);
const connectGoogleDriveCallable = httpsCallable<
  { code: string; redirectUri: string; rootFolderId?: string },
  DriveIntegrationSummary
>(fb.functions, "connectGoogleDrive");
const updateGoogleDriveRootFolderCallable = httpsCallable<
  { rootFolderId: string },
  DriveIntegrationSummary
>(fb.functions, "updateGoogleDriveRootFolder");
const disconnectGoogleDriveCallable = httpsCallable<Record<string, never>, { ok: boolean }>(
  fb.functions,
  "disconnectGoogleDrive",
);

export async function getDriveIntegration(): Promise<DriveIntegrationSummary> {
  const res = await getDriveIntegrationCallable({});
  return res.data;
}

export async function connectGoogleDrive(input: {
  code: string;
  redirectUri: string;
  rootFolderId?: string;
}): Promise<DriveIntegrationSummary> {
  const idToken = await fb.auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Sign in required.");
  const response = await fetch("https://us-central1-solvingclub-cw-management.cloudfunctions.net/connectGoogleDriveHttp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null) as DriveIntegrationSummary | { error?: string } | null;
  if (!response.ok) {
    throw new Error(payload && typeof payload === "object" && "error" in payload && payload.error ? payload.error : "Google Drive could not be connected.");
  }
  return payload as DriveIntegrationSummary;
}

export async function updateGoogleDriveRootFolder(rootFolderId: string): Promise<DriveIntegrationSummary> {
  const res = await updateGoogleDriveRootFolderCallable({ rootFolderId });
  return res.data;
}

export async function disconnectGoogleDrive(): Promise<void> {
  await disconnectGoogleDriveCallable({});
}
