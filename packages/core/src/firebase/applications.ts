import {
  collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc,
  type Firestore,
} from "firebase/firestore";
import { parseApplication, type Application } from "../models/application";

export async function createApplication(
  db: Firestore,
  input: { projectId: string; clientId: string; name: string; type?: string; description?: string },
): Promise<Application> {
  const createdAt = Date.now();
  const status = "active" as const;
  const ref = await addDoc(collection(db, "applications"), {
    projectId: input.projectId, clientId: input.clientId, name: input.name,
    ...(input.type !== undefined && { type: input.type }),
    ...(input.description !== undefined && { description: input.description }),
    status, createdAt,
  });
  return parseApplication({ id: ref.id, ...input, status, createdAt });
}

export async function listApplicationsByProject(db: Firestore, projectId: string): Promise<Application[]> {
  // Equality filter only + client-side sort — avoids a composite index.
  const snap = await getDocs(query(collection(db, "applications"), where("projectId", "==", projectId)));
  return snap.docs
    .map((d) => parseApplication({ id: d.id, ...d.data() }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateApplication(
  db: Firestore, id: string,
  patch: { name?: string; type?: string; description?: string; status?: "active" | "archived" },
): Promise<void> {
  await updateDoc(doc(db, "applications", id), patch);
}

export async function deleteApplication(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, "applications", id));
}
