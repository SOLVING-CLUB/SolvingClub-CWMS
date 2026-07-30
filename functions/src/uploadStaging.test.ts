import { describe, expect, it } from "vitest";
import { isOwnedStagingPath } from "./uploadStaging.js";

describe("isOwnedStagingPath", () => {
  const uid = "member-123";
  const uploadId = "7b51eb71-9b23-4e81-b150-3af1ae075b0a";

  it("accepts a UUID staged directly under the authenticated member", () => {
    expect(isOwnedStagingPath(uid, `staging/${uid}/${uploadId}`)).toBe(true);
  });

  it("rejects another user's path, filenames, nested paths, and malformed IDs", () => {
    expect(isOwnedStagingPath(uid, `staging/another-member/${uploadId}`)).toBe(false);
    expect(isOwnedStagingPath(uid, `staging/${uid}/proposal.pdf`)).toBe(false);
    expect(isOwnedStagingPath(uid, `staging/${uid}/${uploadId}/extra`)).toBe(false);
    expect(isOwnedStagingPath(uid, `staging/${uid}/not-a-uuid`)).toBe(false);
  });
});
