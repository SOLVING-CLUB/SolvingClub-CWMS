import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { db, storage, assertMember } from "./admin.js";
import { ensureFolderPath, uploadFile, driveSaKeyJson, driveRootFolderId, driveShareWith } from "./drive.js";

const ownerTypeSchema = z.enum(["client", "project", "application", "task"]);

const inputSchema = z.object({
  storagePath: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  label: z.string().min(1),
  ownerType: ownerTypeSchema,
  ownerId: z.string().min(1),
});

/** client/project/application names from root to the owner's folder, in order. */
async function resolveFolderNames(
  ownerType: z.infer<typeof ownerTypeSchema>, ownerId: string,
): Promise<{ names: string[]; clientId: string }> {
  if (ownerType === "client") {
    const snap = await db.doc(`clients/${ownerId}`).get();
    if (!snap.exists) throw new HttpsError("not-found", "Client not found.");
    return { names: [snap.get("name")], clientId: ownerId };
  }
  if (ownerType === "project") {
    const snap = await db.doc(`projects/${ownerId}`).get();
    if (!snap.exists) throw new HttpsError("not-found", "Project not found.");
    const clientId = snap.get("clientId") as string;
    const client = await db.doc(`clients/${clientId}`).get();
    return { names: [client.get("name"), snap.get("name")], clientId };
  }
  // application or task: task files are attached under their application's folder.
  const appId = ownerType === "task"
    ? ((await db.doc(`tasks/${ownerId}`).get()).get("applicationId") as string)
    : ownerId;
  const appSnap = await db.doc(`applications/${appId}`).get();
  if (!appSnap.exists) throw new HttpsError("not-found", "Application not found.");
  const projectId = appSnap.get("projectId") as string;
  const clientId = appSnap.get("clientId") as string;
  const [project, client] = await Promise.all([
    db.doc(`projects/${projectId}`).get(),
    db.doc(`clients/${clientId}`).get(),
  ]);
  return { names: [client.get("name"), project.get("name"), appSnap.get("name")], clientId };
}

/**
 * Moves a member's staged upload (Firebase Storage) into the org's Drive
 * folder tree, then records it as a `managed` document. Deletes the staged
 * file whether the Drive upload succeeds or fails, so nothing is orphaned
 * in staging.
 */
export const uploadDocument = onCall(
  { invoker: "public", secrets: [driveSaKeyJson, driveRootFolderId, driveShareWith] },
  async (request) => {
    await assertMember(request.auth?.uid);
    const uid = request.auth!.uid;

    const parsed = inputSchema.safeParse(request.data);
    if (!parsed.success) throw new HttpsError("invalid-argument", "Invalid upload details.");
    const { storagePath, fileName, mimeType, label, ownerType, ownerId } = parsed.data;

    if (storagePath !== `staging/${uid}/${fileName}`) {
      throw new HttpsError("permission-denied", "You may only finalize your own staged upload.");
    }

    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) throw new HttpsError("not-found", "Staged file not found — upload may have failed.");

    try {
      const { names, clientId } = await resolveFolderNames(ownerType, ownerId);
      const folderId = await ensureFolderPath(names);
      const [content] = await file.download();
      const { id: driveFileId, url } = await uploadFile(folderId, fileName, mimeType, content);

      const createdAt = Date.now();
      const docRef = await db.collection("documents").add({
        kind: "managed", label, url, driveFileId, mimeType,
        ownerType, ownerId, clientId, uploadedBy: uid, createdAt,
      });

      return {
        id: docRef.id, kind: "managed", label, url, driveFileId, mimeType,
        ownerType, ownerId, clientId, uploadedBy: uid, createdAt,
      };
    } finally {
      await file.delete().catch((err) => console.warn(`Failed to remove staged file ${storagePath}:`, err));
    }
  },
);
