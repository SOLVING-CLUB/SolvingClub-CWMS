import { initFirebase, connectToEmulators, type FirebaseServices } from "@solvingclub/core";

const config = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

export const fb: FirebaseServices = initFirebase(config);
if (import.meta.env.VITE_USE_EMULATOR === "true") connectToEmulators(fb);
