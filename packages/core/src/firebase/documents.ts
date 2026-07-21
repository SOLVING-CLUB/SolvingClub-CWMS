import {
  collection, addDoc, getDocs, query, where, doc, deleteDoc, type Firestore,
} from "firebase/firestore";
import { parseDocument, type Document, type OwnerType } from "../models/document";

export async function addLinkedDocument(
  db: Firestore,
  input: { label: string; url: string; ownerType: OwnerType; ownerId: string; clientId: string; uploadedBy: string },
): Promise<Document> {
  const createdAt = Date.now();
  const kind = "linked" as const;
  const ref = await addDoc(collection(db, "documents"), {
    kind, label: input.label, url: input.url,
    ownerType: input.ownerType, ownerId: input.ownerId,
    clientId: input.clientId, uploadedBy: input.uploadedBy, createdAt,
  });
  return parseDocument({ id: ref.id, kind, ...input, createdAt });
}

export async function listDocuments(db: Firestore, ownerId: string): Promise<Document[]> {
  // ownerId is a globally-unique doc id, so one equality filter identifies the
  // owner with no composite index. Sort client-side.
  const snap = await getDocs(query(collection(db, "documents"), where("ownerId", "==", ownerId)));
  return snap.docs
    .map((d) => parseDocument({ id: d.id, ...d.data() }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteDocument(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, "documents", id));
}
