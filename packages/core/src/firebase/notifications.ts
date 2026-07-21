import {
  collection, addDoc, getDocs, query, where, doc, updateDoc, type Firestore,
} from "firebase/firestore";
import { parseNotification, type Notification } from "../models/notification";

export const ORG_BROADCAST = "org";

export async function createNotification(
  db: Firestore,
  input: { recipientType: "member" | "client"; recipientId: string; title: string; body?: string; link?: string },
): Promise<Notification> {
  const createdAt = Date.now();
  const read = false;
  const ref = await addDoc(collection(db, "notifications"), { ...input, read, createdAt });
  return parseNotification({ id: ref.id, ...input, read, createdAt });
}

async function fetchByRecipient(
  db: Firestore, recipientType: "member" | "client", recipientId: string,
): Promise<Notification[]> {
  const snap = await getDocs(query(
    collection(db, "notifications"),
    where("recipientType", "==", recipientType),
    where("recipientId", "==", recipientId),
  ));
  return snap.docs.map((d) => parseNotification({ id: d.id, ...d.data() }));
}

/** A member's own notifications plus org-wide broadcasts, newest first. */
export async function listMemberNotifications(db: Firestore, uid: string): Promise<Notification[]> {
  const [own, broadcast] = await Promise.all([
    fetchByRecipient(db, "member", uid),
    fetchByRecipient(db, "member", ORG_BROADCAST),
  ]);
  return [...own, ...broadcast].sort((a, b) => b.createdAt - a.createdAt);
}

export async function listClientNotifications(db: Firestore, clientId: string): Promise<Notification[]> {
  const list = await fetchByRecipient(db, "client", clientId);
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export async function markNotificationRead(db: Firestore, id: string): Promise<void> {
  await updateDoc(doc(db, "notifications", id), { read: true });
}
