import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 20000,
    env: { FIRESTORE_EMULATOR_HOST: "localhost:8080" },
    // Emulator-backed test files share one Firestore namespace, so a
    // clearFirestore() in one file must not race another file's seeded
    // data. Run test files sequentially to keep them isolated.
    fileParallelism: false,
  },
});
