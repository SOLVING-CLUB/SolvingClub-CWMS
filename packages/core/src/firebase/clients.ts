import {
  collection, addDoc, getDocs, getDoc, doc, onSnapshot, query, orderBy, updateDoc, type Firestore, type Unsubscribe,
} from "firebase/firestore";
import { z } from "zod";
import { parseClient, type Client } from "../models/client";

type NewClient = Omit<Client, "id" | "createdAt" | "status"> & {
  status?: Client["status"];
};

export async function createClient(db: Firestore, input: NewClient): Promise<Client> {
  const createdAt = Date.now();
  const status = input.status ?? "active";
  const candidate = parseClient({ id: "pending", ...input, status, createdAt });
  const ref = await addDoc(collection(db, "clients"), {
    name: candidate.name, email: candidate.email, status: candidate.status, createdAt: candidate.createdAt,
    ...(candidate.phone !== undefined && { phone: candidate.phone }),
  });
  return { ...candidate, id: ref.id };
}

export async function listClients(db: Firestore): Promise<Client[]> {
  const q = query(collection(db, "clients"), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => parseClient({ id: d.id, ...d.data() }));
}

export function subscribeClients(
  db: Firestore, onData: (clients: Client[]) => void, onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "clients"), orderBy("createdAt", "asc")),
    (snapshot) => onData(snapshot.docs.map((item) => parseClient({ id: item.id, ...item.data() }))),
    (error) => onError?.(error),
  );
}

export async function getClient(db: Firestore, id: string): Promise<Client | null> {
  const snap = await getDoc(doc(db, "clients", id));
  return snap.exists() ? parseClient({ id: snap.id, ...snap.data() }) : null;
}

/** Keeps a single client profile current without requiring a page refresh. */
export function subscribeClient(
  db: Firestore, id: string, onData: (client: Client | null) => void, onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, "clients", id),
    (snapshot) => onData(snapshot.exists() ? parseClient({ id: snapshot.id, ...snapshot.data() }) : null),
    (error) => onError?.(error),
  );
}

export async function updateClient(
  db: Firestore,
  id: string,
  patch: Partial<Pick<Client, "name" | "email" | "phone" | "status">>,
): Promise<void> {
  const candidate = {
    ...(patch.name !== undefined && { name: z.string().trim().min(1).parse(patch.name) }),
    ...(patch.email !== undefined && { email: z.string().email().parse(patch.email) }),
    ...(patch.phone !== undefined && { phone: z.string().trim().parse(patch.phone) }),
    ...(patch.status !== undefined && { status: z.enum(["active", "archived"]).parse(patch.status) }),
  };
  await updateDoc(doc(db, "clients", id), candidate);
}
