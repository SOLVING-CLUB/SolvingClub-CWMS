import {
  collection, addDoc, getDocs, onSnapshot, query, where, doc, updateDoc, deleteDoc, deleteField,
  type Firestore, type QueryConstraint, type Unsubscribe,
} from "firebase/firestore";
import { parseTask, type Task } from "../models/task";
import { z } from "zod";

type NewTask = {
  applicationId: string; projectId: string; clientId: string;
  title: string; description?: string; assigneeUid?: string;
  dueDate?: number; priority?: number; createdBy: string;
};

type TaskFilter = {
  clientId?: string; projectId?: string; applicationId?: string;
  assigneeUid?: string; status?: Task["status"];
};

export async function createTask(db: Firestore, input: NewTask): Promise<Task> {
  const createdAt = Date.now();
  const status = "todo" as const;
  const priority = input.priority ?? 3;
  const order = createdAt;
  const candidate = parseTask({ id: "pending", ...input, status, priority, order, createdAt });
  const ref = await addDoc(collection(db, "tasks"), {
    applicationId: candidate.applicationId, projectId: candidate.projectId, clientId: candidate.clientId,
    title: candidate.title, status: candidate.status, priority: candidate.priority, order: candidate.order,
    createdBy: candidate.createdBy, createdAt: candidate.createdAt,
    ...(candidate.description !== undefined && { description: candidate.description }),
    ...(candidate.assigneeUid !== undefined && { assigneeUid: candidate.assigneeUid }),
    ...(candidate.dueDate !== undefined && { dueDate: candidate.dueDate }),
  });
  return { ...candidate, id: ref.id };
}

export async function listTasks(db: Firestore, filter: TaskFilter = {}): Promise<Task[]> {
  const constraints: QueryConstraint[] = [];
  if (filter.clientId) constraints.push(where("clientId", "==", filter.clientId));
  if (filter.projectId) constraints.push(where("projectId", "==", filter.projectId));
  if (filter.applicationId) constraints.push(where("applicationId", "==", filter.applicationId));
  if (filter.assigneeUid) constraints.push(where("assigneeUid", "==", filter.assigneeUid));
  if (filter.status) constraints.push(where("status", "==", filter.status));

  const snap = await getDocs(query(collection(db, "tasks"), ...constraints));
  const tasks = snap.docs.map((d) => parseTask({ id: d.id, ...d.data() }));
  // Sort client-side to avoid composite-index requirements: priority asc, then dueDate asc.
  return tasks.sort((a, b) =>
    a.priority - b.priority || (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity),
  );
}

export function subscribeTasks(
  db: Firestore, filter: TaskFilter, onData: (tasks: Task[]) => void, onError?: (error: Error) => void,
): Unsubscribe {
  const constraints: QueryConstraint[] = [];
  if (filter.clientId) constraints.push(where("clientId", "==", filter.clientId));
  if (filter.projectId) constraints.push(where("projectId", "==", filter.projectId));
  if (filter.applicationId) constraints.push(where("applicationId", "==", filter.applicationId));
  if (filter.assigneeUid) constraints.push(where("assigneeUid", "==", filter.assigneeUid));
  if (filter.status) constraints.push(where("status", "==", filter.status));
  return onSnapshot(
    query(collection(db, "tasks"), ...constraints),
    (snapshot) => onData(snapshot.docs
      .map((item) => parseTask({ id: item.id, ...item.data() }))
      .sort((a, b) => a.priority - b.priority || (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity))),
    (error) => onError?.(error),
  );
}

export async function updateTask(
  db: Firestore, id: string,
  patch: Partial<Pick<Task, "title" | "status" | "priority" | "order">> & {
    description?: string | null;
    assigneeUid?: string | null;
    dueDate?: number | null;
  },
): Promise<void> {
  const safe = z.object({
    title: z.string().trim().min(1).max(240).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    status: z.enum(["todo", "in_progress", "blocked", "done"]).optional(),
    priority: z.number().int().min(1).max(5).optional(),
    order: z.number().finite().optional(),
    assigneeUid: z.string().min(1).nullable().optional(),
    dueDate: z.number().finite().nullable().optional(),
  }).strict().parse(patch);
  const update = {
    ...safe,
    ...(safe.description === null && { description: deleteField() }),
    ...(safe.assigneeUid === null && { assigneeUid: deleteField() }),
    ...(safe.dueDate === null && { dueDate: deleteField() }),
  };
  await updateDoc(doc(db, "tasks", id), update);
}

export async function deleteTask(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, "tasks", id));
}
