import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { db } from "./admin.js";

export const ownerTypeSchema = z.enum(["workspace", "client", "project", "application", "task"]);
export const accessLevelSchema = z.enum(["internal", "client"]);

export type DocumentOwnerType = z.infer<typeof ownerTypeSchema>;
export type DocumentAccessLevel = z.infer<typeof accessLevelSchema>;

/** Client/project/application names from root to the owner's Drive folder, in order. */
export async function resolveDocumentFolder(
  ownerType: DocumentOwnerType,
  ownerId: string,
): Promise<{ names: string[]; clientId: string }> {
  if (ownerType === "workspace") {
    return { names: ["SolvingClub Management"], clientId: "__workspace__" };
  }
  if (ownerType === "client") {
    const snap = await db.doc(`clients/${ownerId}`).get();
    if (!snap.exists) throw new HttpsError("not-found", "Client not found.");
    return { names: ["Clients", snap.get("name")], clientId: ownerId };
  }
  if (ownerType === "project") {
    const snap = await db.doc(`projects/${ownerId}`).get();
    if (!snap.exists) throw new HttpsError("not-found", "Project not found.");
    const clientId = snap.get("clientId") as string;
    const client = await db.doc(`clients/${clientId}`).get();
    if (!client.exists) throw new HttpsError("failed-precondition", "Project client not found.");
    return { names: ["Clients", client.get("name"), "Projects", snap.get("name")], clientId };
  }

  let appId = ownerId;
  let taskName: string | undefined;
  if (ownerType === "task") {
    const task = await db.doc(`tasks/${ownerId}`).get();
    if (!task.exists) throw new HttpsError("not-found", "Task not found.");
    appId = task.get("applicationId") as string;
    taskName = task.get("title") as string | undefined;
  }
  const appSnap = await db.doc(`applications/${appId}`).get();
  if (!appSnap.exists) throw new HttpsError("not-found", "Application not found.");
  const projectId = appSnap.get("projectId") as string;
  const clientId = appSnap.get("clientId") as string;
  const [project, client] = await Promise.all([
    db.doc(`projects/${projectId}`).get(),
    db.doc(`clients/${clientId}`).get(),
  ]);
  if (!project.exists) throw new HttpsError("failed-precondition", "Application project not found.");
  if (!client.exists) throw new HttpsError("failed-precondition", "Application client not found.");
  const names = [
    "Clients",
    client.get("name"),
    "Projects",
    project.get("name"),
    "Applications",
    appSnap.get("name"),
  ];
  if (ownerType === "task") {
    names.push("Tasks", taskName ?? `Task ${ownerId.slice(0, 6)}`);
  }
  return { names, clientId };
}
