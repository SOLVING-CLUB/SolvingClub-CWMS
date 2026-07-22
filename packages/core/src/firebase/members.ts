import { collection, doc, getDoc, getDocs, onSnapshot, query, orderBy, type Firestore, type Unsubscribe } from "firebase/firestore";
import { parseMember, type Member } from "../models/member";

export async function listMembers(db: Firestore): Promise<Member[]> {
  const q = query(collection(db, "members"), orderBy("name", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => parseMember({ uid: d.id, ...d.data() }));
}

export function subscribeMembers(
  db: Firestore, onData: (members: Member[]) => void, onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "members"), orderBy("name", "asc")),
    (snapshot) => onData(snapshot.docs.map((item) => parseMember({ uid: item.id, ...item.data() }))),
    (error) => onError?.(error),
  );
}

export async function getMember(db: Firestore, uid: string): Promise<Member | null> {
  const snap = await getDoc(doc(db, "members", uid));
  return snap.exists() ? parseMember({ uid: snap.id, ...snap.data() }) : null;
}
