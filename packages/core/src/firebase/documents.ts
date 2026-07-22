import {
  collection, addDoc, getDocs, onSnapshot, query, where, doc, deleteDoc, type Firestore, type Unsubscribe,
} from "firebase/firestore";
import { parseDocument, type Document, type OwnerType } from "../models/document";

export async function addLinkedDocument(
  db: Firestore,
  input: { label: string; url: string; ownerType: OwnerType; ownerId: string; clientId: string; uploadedBy: string },
): Promise<Document> {
  const createdAt = Date.now();
  const kind = "linked" as const;
  const candidate = parseDocument({ id: "pending", kind, ...input, createdAt });
  const ref = await addDoc(collection(db, "documents"), {
    kind: candidate.kind, label: candidate.label, url: candidate.url,
    ownerType: candidate.ownerType, ownerId: candidate.ownerId,
    clientId: candidate.clientId, uploadedBy: candidate.uploadedBy, createdAt: candidate.createdAt,
  });
  return { ...candidate, id: ref.id };
}

export async function listDocuments(db: Firestore, ownerId: string): Promise<Document[]> {
  // ownerId is a globally-unique doc id, so one equality filter identifies the
  // owner with no composite index. Sort client-side.
  const snap = await getDocs(query(collection(db, "documents"), where("ownerId", "==", ownerId)));
  return snap.docs
    .map((d) => parseDocument({ id: d.id, ...d.data() }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Streams documents linked to one workspace record without requiring a composite index. */
export function subscribeDocuments(
  db: Firestore, ownerId: string, onData: (documents: Document[]) => void, onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "documents"), where("ownerId", "==", ownerId)),
    (snapshot) => onData(snapshot.docs
      .map((item) => parseDocument({ id: item.id, ...item.data() }))
      .sort((a, b) => a.createdAt - b.createdAt)),
    (error) => onError?.(error),
  );
}

export async function deleteDocument(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, "documents", id));
}
