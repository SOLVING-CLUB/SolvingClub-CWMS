import {
  collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc,
  type Firestore, type QueryConstraint,
} from "firebase/firestore";
import { parseTask, type Task } from "../models/task";

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
  const ref = await addDoc(collection(db, "tasks"), {
    applicationId: input.applicationId, projectId: input.projectId, clientId: input.clientId,
    title: input.title, status, priority, order, createdBy: input.createdBy, createdAt,
    ...(input.description !== undefined && { description: input.description }),
    ...(input.assigneeUid !== undefined && { assigneeUid: input.assigneeUid }),
    ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
  });
  return parseTask({ id: ref.id, ...input, status, priority, order, createdAt });
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

export async function updateTask(
  db: Firestore, id: string,
  patch: Partial<Pick<Task, "title" | "description" | "status" | "priority" | "order" | "assigneeUid" | "dueDate">>,
): Promise<void> {
  await updateDoc(doc(db, "tasks", id), patch);
}

export async function deleteTask(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, "tasks", id));
}
