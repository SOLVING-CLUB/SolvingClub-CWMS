import { google, type drive_v3 } from "googleapis";
import { defineSecret } from "firebase-functions/params";
import { Readable } from "node:stream";

type SecretParam = ReturnType<typeof defineSecret>;

export const driveSaKeyJson: SecretParam = defineSecret("DRIVE_SA_KEY_JSON");
export const driveRootFolderId: SecretParam = defineSecret("DRIVE_ROOT_FOLDER_ID");
export const driveShareWith: SecretParam = defineSecret("DRIVE_SHARE_WITH");

const FOLDER_MIME = "application/vnd.google-apps.folder";

let driveClient: drive_v3.Drive | undefined;

function getDrive(): drive_v3.Drive {
  if (driveClient) return driveClient;
  const keyJson = driveSaKeyJson.value();
  if (!keyJson) {
    throw new Error(
      "DRIVE_SA_KEY_JSON secret is not set. Managed Drive uploads are unavailable until a " +
      "service-account key is configured (see go-live checklist). Linked documents still work.",
    );
  }
  const credentials = JSON.parse(keyJson);
  const auth = new google.auth.GoogleAuth({
    credentials, scopes: ["https://www.googleapis.com/auth/drive"],
  });
  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

async function findChildFolder(drive: drive_v3.Drive, name: string, parentId: string): Promise<string | undefined> {
  const escaped = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `name = '${escaped}' and '${parentId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
  });
  return res.data.files?.[0]?.id ?? undefined;
}

/** Finds or creates a folder named `name` under `parentId`, returns its id. */
export async function ensureFolder(name: string, parentId: string): Promise<string> {
  const drive = getDrive();
  const existing = await findChildFolder(drive, name, parentId);
  if (existing) return existing;
  const created = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: "id",
  });
  const id = created.data.id;
  if (!id) throw new Error(`Drive did not return an id for folder "${name}"`);
  return id;
}

let rootFolderIdCache: string | undefined;

/** Finds or creates the org's root Drive folder. Uses DRIVE_ROOT_FOLDER_ID if set. */
export async function getRootFolderId(): Promise<string> {
  if (rootFolderIdCache) return rootFolderIdCache;
  const configured = driveRootFolderId.value();
  if (configured) {
    rootFolderIdCache = configured;
    return configured;
  }
  const id = await ensureFolder("SolvingClub CMS", "root");
  rootFolderIdCache = id;
  return id;
}

/** Resolves (creating as needed) the Drive folder chain for a path of names under root. */
export async function ensureFolderPath(names: string[]): Promise<string> {
  let parentId = await getRootFolderId();
  for (const name of names) {
    parentId = await ensureFolder(name, parentId);
  }
  return parentId;
}

/** Uploads a buffer into a Drive folder and returns its id + a viewable link. */
export async function uploadFile(
  folderId: string, fileName: string, mimeType: string, content: Buffer,
): Promise<{ id: string; url: string }> {
  const drive = getDrive();
  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType, body: Readable.from(content) },
    fields: "id, webViewLink",
  });
  const id = res.data.id;
  if (!id) throw new Error(`Drive did not return an id for file "${fileName}"`);

  const shareList = (driveShareWith.value() || "")
    .split(",").map((e) => e.trim()).filter(Boolean);
  await Promise.all(shareList.map((email: string) =>
    drive.permissions.create({
      fileId: id,
      requestBody: { type: "user", role: "reader", emailAddress: email },
      sendNotificationEmail: false,
    }).catch((err: unknown) => {
      console.warn(`Failed to share Drive file ${id} with ${email}:`, err);
    }),
  ));

  const file = await drive.files.get({ fileId: id, fields: "webViewLink" });
  return { id, url: file.data.webViewLink ?? `https://drive.google.com/file/d/${id}/view` };
}

/** Removes a managed file from Drive. Missing/already-trashed files are treated as deleted. */
export async function deleteDriveFile(fileId: string): Promise<void> {
  const drive = getDrive();
  try { await drive.files.delete({ fileId }); }
  catch (error: unknown) {
    const status = (error as { code?: number }).code;
    if (status !== 404) throw error;
  }
}
