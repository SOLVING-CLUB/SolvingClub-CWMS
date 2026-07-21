import { httpsCallable } from "firebase/functions";
import { fb } from "./firebase";

export const createClientUser = httpsCallable<
  { clientId: string; email: string; password: string },
  { uid: string }
>(fb.functions, "createClientUser");

export const resetClientPassword = httpsCallable<
  { clientId: string; newPassword: string },
  { ok: boolean }
>(fb.functions, "resetClientPassword");
