import { collection, addDoc, getDocs, onSnapshot, query, where, type Firestore, type Unsubscribe } from "firebase/firestore";
import { commentSchema, parseComment, type Comment } from "../models/comment";

export async function addComment(
  db: Firestore,
  input: { taskId: string; clientId: string; authorUid: string; authorType: "member" | "client"; body: string },
): Promise<Comment> {
  const createdAt = Date.now();
  const safe = commentSchema.omit({ id: true, createdAt: true }).parse(input);
  const ref = await addDoc(collection(db, "comments"), { ...safe, createdAt });
  return parseComment({ id: ref.id, ...safe, createdAt });
}

export async function listComments(db: Firestore, taskId: string): Promise<Comment[]> {
  // Equality filter only + client-side sort — avoids a composite index.
  const snap = await getDocs(query(collection(db, "comments"), where("taskId", "==", taskId)));
  return snap.docs
    .map((d) => parseComment({ id: d.id, ...d.data() }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Keeps a task conversation synchronized across the member and client portals. */
export function subscribeComments(
  db: Firestore,
  taskId: string,
  onData: (comments: Comment[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "comments"), where("taskId", "==", taskId)),
    (snapshot) => onData(snapshot.docs
      .map((item) => parseComment({ id: item.id, ...item.data() }))
      .sort((a, b) => a.createdAt - b.createdAt)),
    (error) => onError?.(error),
  );
}
