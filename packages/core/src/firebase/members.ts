import { collection, getDocs, query, orderBy, type Firestore } from "firebase/firestore";
import { parseMember, type Member } from "../models/member";

export async function listMembers(db: Firestore): Promise<Member[]> {
  const q = query(collection(db, "members"), orderBy("name", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => parseMember({ uid: d.id, ...d.data() }));
}
