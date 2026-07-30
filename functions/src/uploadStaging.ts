export const stagingIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True only for a UUID object staged directly under the authenticated user's prefix. */
export function isOwnedStagingPath(uid: string, storagePath: string): boolean {
  const prefix = `staging/${uid}/`;
  return storagePath.startsWith(prefix) && stagingIdPattern.test(storagePath.slice(prefix.length));
}
