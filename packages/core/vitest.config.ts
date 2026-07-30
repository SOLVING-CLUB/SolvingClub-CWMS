import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 20000,
    // beforeEach clears Firestore and re-seeds a hierarchy; under a full-suite
    // run that exceeds vitest's 10s hook default even though the test body is
    // fast, and hookTimeout does not inherit from testTimeout.
    hookTimeout: 30000,
    env: { FIRESTORE_EMULATOR_HOST: "localhost:8080" },
    // Emulator-backed test files share one Firestore namespace, so a
    // clearFirestore() in one file must not race another file's seeded
    // data. Run test files sequentially to keep them isolated.
    fileParallelism: false,
  },
});
