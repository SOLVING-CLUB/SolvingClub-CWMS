import {
  collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc,
  type Firestore,
} from "firebase/firestore";
import { parseProject, type Project } from "../models/project";

export async function createProject(
  db: Firestore, input: { clientId: string; name: string; description?: string },
): Promise<Project> {
  const createdAt = Date.now();
  const status = "active" as const;
  const ref = await addDoc(collection(db, "projects"), {
    clientId: input.clientId, name: input.name,
    ...(input.description !== undefined && { description: input.description }),
    status, createdAt,
  });
  return parseProject({ id: ref.id, ...input, status, createdAt });
}

export async function listProjectsByClient(db: Firestore, clientId: string): Promise<Project[]> {
  // Equality filter only + client-side sort — avoids a composite index
  // (where + orderBy on a different field would require one in production).
  const snap = await getDocs(query(collection(db, "projects"), where("clientId", "==", clientId)));
  return snap.docs
    .map((d) => parseProject({ id: d.id, ...d.data() }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateProject(
  db: Firestore, id: string,
  patch: { name?: string; description?: string; status?: "active" | "archived" },
): Promise<void> {
  await updateDoc(doc(db, "projects", id), patch);
}

export async function deleteProject(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, "projects", id));
}
