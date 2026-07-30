import {
  collection, addDoc, getDocs, onSnapshot, query, where, doc, updateDoc, deleteDoc, deleteField,
  type Firestore, type Unsubscribe,
} from "firebase/firestore";
import { parseProject, techStackEntrySchema, type Project } from "../models/project";
import { projectTypeSchema, type ProjectType } from "../models/enums";
import { z } from "zod";

export async function createProject(
  db: Firestore,
  input: {
    clientId: string; name: string; description?: string;
    type?: ProjectType; startDate?: number; techStack?: string[];
  },
): Promise<Project> {
  const createdAt = Date.now();
  const status = "active" as const;
  const candidate = parseProject({ id: "pending", ...input, status, createdAt });
  const ref = await addDoc(collection(db, "projects"), {
    clientId: candidate.clientId, name: candidate.name, status: candidate.status, createdAt: candidate.createdAt,
    // Absent optionals stay absent — rules validators reject a null here.
    ...(candidate.description !== undefined && { description: candidate.description }),
    ...(candidate.type !== undefined && { type: candidate.type }),
    ...(candidate.startDate !== undefined && { startDate: candidate.startDate }),
    ...(candidate.techStack?.length ? { techStack: candidate.techStack } : {}),
  });
  return { ...candidate, id: ref.id };
}

export async function listProjectsByClient(db: Firestore, clientId: string): Promise<Project[]> {
  // Equality filter only + client-side sort — avoids a composite index
  // (where + orderBy on a different field would require one in production).
  const snap = await getDocs(query(collection(db, "projects"), where("clientId", "==", clientId)));
  return snap.docs
    .map((d) => parseProject({ id: d.id, ...d.data() }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Streams one project record for standalone project workspaces. */
export function subscribeProject(
  db: Firestore, id: string, onData: (project: Project | null) => void, onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, "projects", id),
    (snapshot) => onData(snapshot.exists() ? parseProject({ id: snapshot.id, ...snapshot.data() }) : null),
    (error) => onError?.(error),
  );
}

/** Streams one client's projects, ordered without requiring a composite index. */
export function subscribeProjectsByClient(
  db: Firestore, clientId: string, onData: (projects: Project[]) => void, onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "projects"), where("clientId", "==", clientId)),
    (snapshot) => onData(snapshot.docs
      .map((item) => parseProject({ id: item.id, ...item.data() }))
      .sort((a, b) => a.createdAt - b.createdAt)),
    (error) => onError?.(error),
  );
}

/** Lists every project for internal workspace views. */
export async function listProjects(db: Firestore): Promise<Project[]> {
  const snap = await getDocs(collection(db, "projects"));
  return snap.docs
    .map((d) => parseProject({ id: d.id, ...d.data() }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Streams every project for internal cross-client workspace views. */
export function subscribeProjects(
  db: Firestore, onData: (projects: Project[]) => void, onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(collection(db, "projects"), (snapshot) => onData(snapshot.docs
    .map((item) => parseProject({ id: item.id, ...item.data() }))
    .sort((a, b) => a.createdAt - b.createdAt)), (error) => onError?.(error));
}

export async function updateProject(
  db: Firestore, id: string,
  patch: {
    name?: string; description?: string | null; status?: "active" | "archived";
    type?: ProjectType | null; startDate?: number | null; techStack?: string[] | null;
  },
): Promise<void> {
  const safe = z.object({
    name: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    status: z.enum(["active", "archived"]).optional(),
    type: projectTypeSchema.nullable().optional(),
    startDate: z.number().nullable().optional(),
    techStack: z.array(techStackEntrySchema).max(24).nullable().optional(),
  }).strict().parse(patch);
  // null means "clear this field": rules reject a stored null, so remove the key.
  const cleared = Object.fromEntries(
    (["description", "type", "startDate", "techStack"] as const)
      .filter((key) => safe[key] === null)
      .map((key) => [key, deleteField()]),
  );
  const written = Object.fromEntries(Object.entries(safe).filter(([, value]) => value !== null));
  await updateDoc(doc(db, "projects", id), { ...written, ...cleared });
}

export async function deleteProject(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, "projects", id));
}
