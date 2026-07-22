import {
  collection, addDoc, getDocs, getDoc, onSnapshot, query, where, doc, updateDoc, deleteDoc, deleteField,
  type Firestore, type Unsubscribe,
} from "firebase/firestore";
import { parseApplication, type Application } from "../models/application";
import { z } from "zod";

export async function createApplication(
  db: Firestore,
  input: { projectId: string; clientId: string; name: string; type?: string; description?: string },
): Promise<Application> {
  const createdAt = Date.now();
  const status = "active" as const;
  const candidate = parseApplication({ id: "pending", ...input, status, createdAt });
  const ref = await addDoc(collection(db, "applications"), {
    projectId: candidate.projectId, clientId: candidate.clientId, name: candidate.name,
    status: candidate.status, createdAt: candidate.createdAt,
    ...(candidate.type !== undefined && { type: candidate.type }),
    ...(candidate.description !== undefined && { description: candidate.description }),
  });
  return { ...candidate, id: ref.id };
}

export async function listApplicationsByProject(
  db: Firestore,
  projectId: string,
  clientId?: string,
): Promise<Application[]> {
  // Equality filter only + client-side sort — avoids a composite index.
  const constraints = [where("projectId", "==", projectId)];
  // Client sessions must constrain collection queries by the ownership field
  // used by Firestore rules. Rules authorize queries; they do not filter them.
  if (clientId) constraints.push(where("clientId", "==", clientId));
  const snap = await getDocs(query(collection(db, "applications"), ...constraints));
  return snap.docs
    .map((d) => parseApplication({ id: d.id, ...d.data() }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Streams applications for a project; client sessions keep the ownership filter required by rules. */
export function subscribeApplicationsByProject(
  db: Firestore,
  projectId: string,
  clientId: string | undefined,
  onData: (applications: Application[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const constraints = [where("projectId", "==", projectId)];
  if (clientId) constraints.push(where("clientId", "==", clientId));
  return onSnapshot(
    query(collection(db, "applications"), ...constraints),
    (snapshot) => onData(snapshot.docs
      .map((item) => parseApplication({ id: item.id, ...item.data() }))
      .sort((a, b) => a.createdAt - b.createdAt)),
    (error) => onError?.(error),
  );
}

/** Streams a client's applications for client-level delivery summaries without loading every project independently. */
export function subscribeApplicationsByClient(
  db: Firestore,
  clientId: string,
  onData: (applications: Application[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "applications"), where("clientId", "==", clientId)),
    (snapshot) => onData(snapshot.docs
      .map((item) => parseApplication({ id: item.id, ...item.data() }))
      .sort((a, b) => a.createdAt - b.createdAt)),
    (error) => onError?.(error),
  );
}

/** Lists every application for internal cross-client work views. */
export async function listApplications(db: Firestore): Promise<Application[]> {
  const snap = await getDocs(collection(db, "applications"));
  return snap.docs
    .map((d) => parseApplication({ id: d.id, ...d.data() }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Streams every application for internal cross-client workspace views. */
export function subscribeApplications(
  db: Firestore, onData: (applications: Application[]) => void, onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(collection(db, "applications"), (snapshot) => onData(snapshot.docs
    .map((item) => parseApplication({ id: item.id, ...item.data() }))
    .sort((a, b) => a.createdAt - b.createdAt)), (error) => onError?.(error));
}

export async function getApplication(db: Firestore, id: string): Promise<Application | null> {
  const snap = await getDoc(doc(db, "applications", id));
  return snap.exists() ? parseApplication({ id: snap.id, ...snap.data() }) : null;
}

/** Streams one application record for detail pages and task workspaces. */
export function subscribeApplication(
  db: Firestore, id: string, onData: (application: Application | null) => void, onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, "applications", id),
    (snapshot) => onData(snapshot.exists() ? parseApplication({ id: snapshot.id, ...snapshot.data() }) : null),
    (error) => onError?.(error),
  );
}

export async function updateApplication(
  db: Firestore, id: string,
  patch: { name?: string; type?: string | null; description?: string | null; status?: "active" | "archived" },
): Promise<void> {
  const safe = z.object({
    name: z.string().trim().min(1).max(160).optional(),
    type: z.string().trim().min(1).max(80).nullable().optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    status: z.enum(["active", "archived"]).optional(),
  }).strict().parse(patch);
  await updateDoc(doc(db, "applications", id), {
    ...safe,
    ...(safe.type === null && { type: deleteField() }),
    ...(safe.description === null && { description: deleteField() }),
  });
}

export async function deleteApplication(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, "applications", id));
}
