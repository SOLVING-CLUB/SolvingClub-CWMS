import {
  collection, addDoc, getDocs, query, orderBy, type Firestore,
} from "firebase/firestore";
import { parseClient, type Client } from "../models/client";

type NewClient = Omit<Client, "id" | "createdAt" | "status"> & {
  status?: Client["status"];
};

export async function createClient(db: Firestore, input: NewClient): Promise<Client> {
  const createdAt = Date.now();
  const status = input.status ?? "active";
  const ref = await addDoc(collection(db, "clients"), {
    name: input.name, email: input.email, phone: input.phone ?? null,
    status, createdAt,
  });
  return parseClient({ id: ref.id, ...input, status, createdAt });
}

export async function listClients(db: Firestore): Promise<Client[]> {
  const q = query(collection(db, "clients"), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    // Firestore stores an absent optional `phone` as null (writes can't use
    // `undefined`); normalize it back so it satisfies `clientSchema`'s
    // `phone: z.string().optional()`, which does not accept null.
    return parseClient({ id: d.id, ...data, phone: data.phone ?? undefined });
  });
}
