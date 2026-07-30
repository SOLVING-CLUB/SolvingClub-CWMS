import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  // jsdom so component behaviour (not just pure helpers) can be asserted.
  test: {
    environment: "jsdom",
    globals: false,
    restoreMocks: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          "firebase-core": ["firebase/app"],
          "firebase-auth": ["firebase/auth"],
          "firebase-firestore": ["firebase/firestore"],
          "firebase-functions": ["firebase/functions"],
          "firebase-storage": ["firebase/storage"],
          "react-aria": ["react-aria-components"],
        },
      },
    },
  },
});
