import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 20000,
    env: { FIRESTORE_EMULATOR_HOST: "localhost:8080" },
  },
});
