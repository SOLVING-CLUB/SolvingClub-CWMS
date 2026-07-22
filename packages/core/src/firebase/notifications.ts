import {
  collection, addDoc, getDocs, onSnapshot, query, where, doc, updateDoc, writeBatch, type Firestore, type Unsubscribe,
} from "firebase/firestore";
import { parseNotification, type Notification } from "../models/notification";

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

/** A member's recipient-specific notifications, newest first. */
export async function listMemberNotifications(db: Firestore, uid: string): Promise<Notification[]> {
  const own = await fetchByRecipient(db, "member", uid);
  return own.sort((a, b) => b.createdAt - a.createdAt);
}

export async function listClientNotifications(db: Firestore, clientId: string): Promise<Notification[]> {
  const list = await fetchByRecipient(db, "client", clientId);
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

function subscribeByRecipient(
  db: Firestore,
  recipientType: "member" | "client",
  recipientId: string,
  onData: (notifications: Notification[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "notifications"), where("recipientType", "==", recipientType), where("recipientId", "==", recipientId)),
    (snapshot) => onData(snapshot.docs
      .map((item) => parseNotification({ id: item.id, ...item.data() }))
      .sort((a, b) => b.createdAt - a.createdAt)),
    (error) => onError?.(error),
  );
}

export function subscribeMemberNotifications(
  db: Firestore, uid: string, onData: (notifications: Notification[]) => void, onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeByRecipient(db, "member", uid, onData, onError);
}

export function subscribeClientNotifications(
  db: Firestore, clientId: string, onData: (notifications: Notification[]) => void, onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeByRecipient(db, "client", clientId, onData, onError);
}

export async function markNotificationRead(db: Firestore, id: string): Promise<void> {
  await updateDoc(doc(db, "notifications", id), { read: true });
}

export async function markNotificationsRead(db: Firestore, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const batch = writeBatch(db);
  ids.forEach((id) => batch.update(doc(db, "notifications", id), { read: true }));
  await batch.commit();
}
