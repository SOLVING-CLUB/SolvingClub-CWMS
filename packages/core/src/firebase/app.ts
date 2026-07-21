import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import {
  getFirestore, connectFirestoreEmulator, type Firestore,
} from "firebase/firestore";
import {
  getFunctions, connectFunctionsEmulator, type Functions,
} from "firebase/functions";

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  functions: Functions;
}

export function initFirebase(config: Record<string, string>): FirebaseServices {
  const app = initializeApp(config);
  return { app, auth: getAuth(app), db: getFirestore(app), functions: getFunctions(app) };
}

export function connectToEmulators(s: FirebaseServices): void {
  connectAuthEmulator(s.auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(s.db, "localhost", 8080);
  connectFunctionsEmulator(s.functions, "localhost", 5001);
}
