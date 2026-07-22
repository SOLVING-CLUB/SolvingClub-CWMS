import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { assertOwnerOrAdmin, db } from "./admin.js";
import { deleteDriveFile, driveSaKeyJson } from "./drive.js";

const idSchema = z.object({ id: z.string().min(1).max(200) });

async function deleteRefs(refs: FirebaseFirestore.DocumentReference[]) {
  const unique = new Map(refs.map((ref) => [ref.path, ref]));
  const documentRefs = [...unique.values()].filter((ref) => ref.parent.id === "documents");
  const documentSnaps = await Promise.all(documentRefs.map((ref) => ref.get()));
  await Promise.all(documentSnaps.map(async (snap) => {
    const driveFileId = snap.get("driveFileId") as string | undefined;
    if (driveFileId) await deleteDriveFile(driveFileId).catch((error) => console.warn(`Drive cleanup failed for ${driveFileId}:`, error));
  }));
  const writer = db.bulkWriter();
  for (const ref of unique.values()) writer.delete(ref);
  await writer.close();
  return unique.size;
}

async function descendants(applicationIds: string[], taskIds: string[], clientId: string) {
  const [comments, documents] = await Promise.all([
    taskIds.length
      ? Promise.all(taskIds.map((taskId) => db.collection("comments").where("taskId", "==", taskId).get()))
      : Promise.resolve([]),
    db.collection("documents").where("clientId", "==", clientId).get(),
  ]);
  const ownerIds = new Set([...applicationIds, ...taskIds]);
  return [
    ...comments.flatMap((snapshot) => snapshot.docs.map((doc) => doc.ref)),
    ...documents.docs.filter((doc) => ownerIds.has(doc.get("ownerId") as string)).map((doc) => doc.ref),
  ];
}

export const deleteApplicationTree = onCall({ invoker: "public", secrets: [driveSaKeyJson] }, async (request) => {
  await assertOwnerOrAdmin(request.auth?.uid);
  const parsed = idSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Invalid application id.");

  const applicationRef = db.doc(`applications/${parsed.data.id}`);
  const application = await applicationRef.get();
  if (!application.exists) throw new HttpsError("not-found", "Application not found.");
  const clientId = application.get("clientId") as string;
  const tasks = await db.collection("tasks").where("applicationId", "==", parsed.data.id).get();
  const taskIds = tasks.docs.map((doc) => doc.id);
  const nested = await descendants([parsed.data.id], taskIds, clientId);
  const count = await deleteRefs([applicationRef, ...tasks.docs.map((doc) => doc.ref), ...nested]);
  return { deleted: count };
});

export const deleteProjectTree = onCall({ invoker: "public", secrets: [driveSaKeyJson] }, async (request) => {
  await assertOwnerOrAdmin(request.auth?.uid);
  const parsed = idSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Invalid project id.");

  const projectRef = db.doc(`projects/${parsed.data.id}`);
  const project = await projectRef.get();
  if (!project.exists) throw new HttpsError("not-found", "Project not found.");
  const clientId = project.get("clientId") as string;
  const [applications, tasks, projectDocuments] = await Promise.all([
    db.collection("applications").where("projectId", "==", parsed.data.id).get(),
    db.collection("tasks").where("projectId", "==", parsed.data.id).get(),
    db.collection("documents").where("ownerId", "==", parsed.data.id).get(),
  ]);
  const applicationIds = applications.docs.map((doc) => doc.id);
  const taskIds = tasks.docs.map((doc) => doc.id);
  const nested = await descendants(applicationIds, taskIds, clientId);
  const count = await deleteRefs([
    projectRef,
    ...applications.docs.map((doc) => doc.ref),
    ...tasks.docs.map((doc) => doc.ref),
    ...projectDocuments.docs.map((doc) => doc.ref),
    ...nested,
  ]);
  return { deleted: count };
});

export const deleteTaskTree = onCall({ invoker: "public", secrets: [driveSaKeyJson] }, async (request) => {
  await assertOwnerOrAdmin(request.auth?.uid);
  const parsed = idSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Invalid task id.");
  const taskRef = db.doc(`tasks/${parsed.data.id}`);
  const task = await taskRef.get();
  if (!task.exists) throw new HttpsError("not-found", "Task not found.");
  const [comments, documents] = await Promise.all([
    db.collection("comments").where("taskId", "==", parsed.data.id).get(),
    db.collection("documents").where("ownerId", "==", parsed.data.id).get(),
  ]);
  const count = await deleteRefs([taskRef, ...comments.docs.map((doc) => doc.ref), ...documents.docs.map((doc) => doc.ref)]);
  return { deleted: count };
});
