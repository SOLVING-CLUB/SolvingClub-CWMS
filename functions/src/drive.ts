import { randomBytes, createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { Readable } from "node:stream";
import { defineSecret } from "firebase-functions/params";
import { google, type drive_v3 } from "googleapis";
import { db } from "./admin.js";

type SecretParam = ReturnType<typeof defineSecret>;

export const driveOauthClientId: SecretParam = defineSecret("GOOGLE_DRIVE_OAUTH_CLIENT_ID");
export const driveOauthClientSecret: SecretParam = defineSecret("GOOGLE_DRIVE_OAUTH_CLIENT_SECRET");
export const driveTokenCipherKey: SecretParam = defineSecret("GOOGLE_DRIVE_TOKEN_CIPHER_KEY");

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const USERINFO_SCOPE = "https://www.googleapis.com/auth/userinfo.email";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const INTEGRATION_PATH = "integrations/googleDriveDefault";

type DriveConnectionDoc = {
  status: "active" | "disconnected";
  mode: "personal_oauth";
  connectedByUid: string;
  connectedEmail: string;
  connectedAt: number;
  updatedAt: number;
  refreshTokenCiphertext: string;
  rootFolderId: string;
  rootFolderName: string;
  rootFolderUrl: string;
};

export type DriveIntegrationSummary = {
  status: "missing" | "active";
  mode: "personal_oauth" | null;
  connectedEmail: string | null;
  connectedAt: number | null;
  rootFolderId: string | null;
  rootFolderName: string | null;
  rootFolderUrl: string | null;
  requiredConfig: {
    webClientId: boolean;
    webClientSecret: boolean;
    tokenCipherKey: boolean;
  };
};

export class DriveConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DriveConfigurationError";
  }
}

function configuredSecret(secret: SecretParam, name: string): string {
  const value = secret.value().trim();
  if (!value || value === "NOT_CONFIGURED") {
    throw new DriveConfigurationError(`${name} has not been configured.`);
  }
  return value;
}

function getCipherKey(): Buffer {
  const value = configuredSecret(driveTokenCipherKey, "GOOGLE_DRIVE_TOKEN_CIPHER_KEY");
  try {
    const parsed = Buffer.from(value, "base64");
    if (parsed.length === 32) return parsed;
  } catch {
    // Fall through to deterministic hash if the secret is not base64.
  }
  return createHash("sha256").update(value).digest();
}

function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${authTag.toString("base64")}.${encrypted.toString("base64")}`;
}

function decryptToken(ciphertext: string): string {
  const [ivBase64, authTagBase64, encryptedBase64] = ciphertext.split(".");
  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new DriveConfigurationError("Stored Google Drive token is invalid.");
  }
  const decipher = createDecipheriv("aes-256-gcm", getCipherKey(), Buffer.from(ivBase64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagBase64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function getOAuthClient(redirectUri?: string) {
  return new google.auth.OAuth2(
    configuredSecret(driveOauthClientId, "GOOGLE_DRIVE_OAUTH_CLIENT_ID"),
    configuredSecret(driveOauthClientSecret, "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET"),
    redirectUri,
  );
}

function integrationRef() {
  return db.doc(INTEGRATION_PATH);
}

async function getConnectionDoc(): Promise<DriveConnectionDoc | null> {
  const snap = await integrationRef().get();
  if (!snap.exists) return null;
  const data = snap.data() as Partial<DriveConnectionDoc> | undefined;
  if (!data || data.status !== "active" || data.mode !== "personal_oauth") return null;
  if (!data.refreshTokenCiphertext || !data.rootFolderId || !data.rootFolderName || !data.rootFolderUrl || !data.connectedEmail) {
    throw new DriveConfigurationError("Google Drive integration is incomplete.");
  }
  return data as DriveConnectionDoc;
}

async function getAuthorizedDrive(): Promise<{ drive: drive_v3.Drive; connection: DriveConnectionDoc }> {
  const connection = await getConnectionDoc();
  if (!connection) {
    throw new DriveConfigurationError("Google Drive has not been connected yet.");
  }
  const oauth = getOAuthClient();
  oauth.setCredentials({ refresh_token: decryptToken(connection.refreshTokenCiphertext) });
  const drive = google.drive({ version: "v3", auth: oauth });
  return { drive, connection };
}

async function getRootFolderMeta(drive: drive_v3.Drive, rootFolderId: string) {
  const res = await drive.files.get({
    fileId: rootFolderId,
    fields: "id, name, mimeType, webViewLink, trashed",
    supportsAllDrives: true,
  });
  if (res.data.mimeType !== FOLDER_MIME || res.data.trashed) {
    throw new DriveConfigurationError("The selected Google Drive root must be an active folder.");
  }
  return {
    id: res.data.id ?? rootFolderId,
    name: res.data.name ?? "SolvingClub CWMS",
    url: res.data.webViewLink ?? `https://drive.google.com/drive/folders/${rootFolderId}`,
  };
}

async function findChildFolder(drive: drive_v3.Drive, name: string, parentId: string): Promise<string | undefined> {
  const escaped = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `name = '${escaped}' and '${parentId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files?.[0]?.id ?? undefined;
}

async function ensureFolderWithDrive(drive: drive_v3.Drive, name: string, parentId: string): Promise<string> {
  const existing = await findChildFolder(drive, name, parentId);
  if (existing) return existing;
  const created = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: "id",
    supportsAllDrives: true,
  });
  const id = created.data.id;
  if (!id) throw new Error(`Drive did not return an id for folder "${name}"`);
  return id;
}

export async function buildDriveIntegrationSummary(): Promise<DriveIntegrationSummary> {
  const requiredConfig = {
    webClientId: false,
    webClientSecret: false,
    tokenCipherKey: false,
  };
  try { requiredConfig.webClientId = Boolean(configuredSecret(driveOauthClientId, "GOOGLE_DRIVE_OAUTH_CLIENT_ID")); } catch {}
  try { requiredConfig.webClientSecret = Boolean(configuredSecret(driveOauthClientSecret, "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET")); } catch {}
  try { requiredConfig.tokenCipherKey = Boolean(configuredSecret(driveTokenCipherKey, "GOOGLE_DRIVE_TOKEN_CIPHER_KEY")); } catch {}

  const connection = await getConnectionDoc();
  if (!connection) {
    return {
      status: "missing",
      mode: null,
      connectedEmail: null,
      connectedAt: null,
      rootFolderId: null,
      rootFolderName: null,
      rootFolderUrl: null,
      requiredConfig,
    };
  }
  return {
    status: "active",
    mode: "personal_oauth",
    connectedEmail: connection.connectedEmail,
    connectedAt: connection.connectedAt,
    rootFolderId: connection.rootFolderId,
    rootFolderName: connection.rootFolderName,
    rootFolderUrl: connection.rootFolderUrl,
    requiredConfig,
  };
}

export async function exchangeDriveCode(params: {
  code: string;
  redirectUri: string;
  rootFolderId?: string;
  connectedByUid: string;
}): Promise<DriveIntegrationSummary> {
  const oauth = getOAuthClient(params.redirectUri);
  const tokenRes = await oauth.getToken({
    code: params.code,
    redirect_uri: params.redirectUri,
  });
  const refreshToken = tokenRes.tokens.refresh_token;
  if (!refreshToken) {
    const existing = await getConnectionDoc();
    if (!existing) {
      throw new DriveConfigurationError("Google did not return a refresh token. Reconnect with consent to finish setup.");
    }
  }
  oauth.setCredentials(tokenRes.tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: oauth });
  const me = await oauth2.userinfo.get();
  const email = me.data.email?.trim();
  if (!email) throw new DriveConfigurationError("Google Drive connection did not return an account email.");
  const drive = google.drive({ version: "v3", auth: oauth });
  const root = params.rootFolderId?.trim()
    ? await getRootFolderMeta(drive, params.rootFolderId.trim())
    : await createDefaultRootFolder(drive);

  const previous = await getConnectionDoc();
  await integrationRef().set({
    status: "active",
    mode: "personal_oauth",
    connectedByUid: params.connectedByUid,
    connectedEmail: email,
    connectedAt: previous?.connectedAt ?? Date.now(),
    updatedAt: Date.now(),
    refreshTokenCiphertext: encryptToken(refreshToken ?? decryptToken(previous!.refreshTokenCiphertext)),
    rootFolderId: root.id,
    rootFolderName: root.name,
    rootFolderUrl: root.url,
  } satisfies DriveConnectionDoc);

  return buildDriveIntegrationSummary();
}

async function createDefaultRootFolder(drive: drive_v3.Drive) {
  const created = await drive.files.create({
    requestBody: { name: "SolvingClub CWMS", mimeType: FOLDER_MIME },
    fields: "id, name, webViewLink",
  });
  const id = created.data.id;
  if (!id) throw new Error("Drive did not return an id for the CWMS root folder.");
  return {
    id,
    name: created.data.name ?? "SolvingClub CWMS",
    url: created.data.webViewLink ?? `https://drive.google.com/drive/folders/${id}`,
  };
}

export async function updateDriveRootFolder(rootFolderId: string): Promise<DriveIntegrationSummary> {
  const { drive, connection } = await getAuthorizedDrive();
  const root = await getRootFolderMeta(drive, rootFolderId.trim());
  await integrationRef().set({
    ...connection,
    rootFolderId: root.id,
    rootFolderName: root.name,
    rootFolderUrl: root.url,
    updatedAt: Date.now(),
  } satisfies DriveConnectionDoc);
  return buildDriveIntegrationSummary();
}

export async function disconnectDrive(): Promise<void> {
  const connection = await getConnectionDoc();
  if (!connection) {
    await integrationRef().set({ status: "disconnected", updatedAt: Date.now() }, { merge: true });
    return;
  }
  const oauth = getOAuthClient();
  oauth.setCredentials({ refresh_token: decryptToken(connection.refreshTokenCiphertext) });
  try { await oauth.revokeCredentials(); } catch (error) { console.warn("Drive token revocation failed:", error); }
  await integrationRef().set({
    status: "disconnected",
    mode: "personal_oauth",
    connectedByUid: connection.connectedByUid,
    connectedEmail: connection.connectedEmail,
    connectedAt: connection.connectedAt,
    updatedAt: Date.now(),
  }, { merge: false });
}

/** Resolves (creating as needed) the Drive folder chain for a path of names under root. */
export async function ensureFolderPath(names: string[]): Promise<string> {
  const { drive, connection } = await getAuthorizedDrive();
  let parentId = connection.rootFolderId;
  for (const name of names) {
    parentId = await ensureFolderWithDrive(drive, name, parentId);
  }
  return parentId;
}

export type DriveFolderFile = {
  id: string;
  name: string;
  mimeType: string;
  url: string;
};

export async function makeDriveFilePubliclyViewable(fileId: string): Promise<void> {
  const { drive } = await getAuthorizedDrive();
  await makeFilePubliclyViewable(drive, fileId);
}

async function makeFilePubliclyViewable(drive: drive_v3.Drive, fileId: string): Promise<void> {
  await drive.permissions.create({
    fileId,
    requestBody: { type: "anyone", role: "reader" },
    supportsAllDrives: true,
  });
}

export async function listFilesInFolder(folderId: string): Promise<DriveFolderFile[]> {
  const { drive } = await getAuthorizedDrive();
  const files: DriveFolderFile[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType != '${FOLDER_MIME}' and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, webViewLink)",
      spaces: "drive",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken,
    });
    for (const file of res.data.files ?? []) {
      if (!file.id || !file.name || !file.mimeType) continue;
      files.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        url: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return files;
}

/** Uploads a buffer into a Drive folder and returns its id + a viewable link. */
export async function uploadFile(params: {
  folderId: string;
  fileName: string;
  mimeType: string;
  content: Buffer;
}): Promise<{ id: string; url: string }> {
  const { drive } = await getAuthorizedDrive();
  const res = await drive.files.create({
    requestBody: { name: params.fileName, parents: [params.folderId] },
    media: { mimeType: params.mimeType, body: Readable.from(params.content) },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });
  const id = res.data.id;
  if (!id) throw new Error(`Drive did not return an id for file "${params.fileName}"`);

  await makeFilePubliclyViewable(drive, id).catch((error) => {
    console.warn("Drive public link permission failed after upload", {
      fileId: id,
      code: (error as { code?: number; response?: { status?: number } }).code
        ?? (error as { response?: { status?: number } }).response?.status,
      message: (error as { message?: string }).message,
    });
  });

  const file = await drive.files.get({
    fileId: id,
    fields: "webViewLink",
    supportsAllDrives: true,
  });
  return { id, url: file.data.webViewLink ?? `https://drive.google.com/file/d/${id}/view` };
}

/** Removes a managed file from Drive. Missing/already-trashed files are treated as deleted. */
export async function deleteDriveFile(fileId: string): Promise<void> {
  const { drive } = await getAuthorizedDrive();
  try {
    await drive.files.delete({ fileId, supportsAllDrives: true });
  } catch (error: unknown) {
    const status = (error as { code?: number }).code;
    if (status !== 404) throw error;
  }
}

export function driveOauthScopes() {
  return [DRIVE_SCOPE, USERINFO_SCOPE];
}
