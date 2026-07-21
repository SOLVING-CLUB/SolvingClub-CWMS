import { collection, addDoc, getDocs, query, where, type Firestore } from "firebase/firestore";
import { parseComment, type Comment } from "../models/comment";

export async function addComment(
  db: Firestore,
  input: { taskId: string; clientId: string; authorUid: string; authorType: "member" | "client"; body: string },
): Promise<Comment> {
  const createdAt = Date.now();
  const ref = await addDoc(collection(db, "comments"), { ...input, createdAt });
  return parseComment({ id: ref.id, ...input, createdAt });
}

export async function listComments(db: Firestore, taskId: string): Promise<Comment[]> {
  // Equality filter only + client-side sort — avoids a composite index.
  const snap = await getDocs(query(collection(db, "comments"), where("taskId", "==", taskId)));
  return snap.docs
    .map((d) => parseComment({ id: d.id, ...d.data() }))
    .sort((a, b) => a.createdAt - b.createdAt);
}
