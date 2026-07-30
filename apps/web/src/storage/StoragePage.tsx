import { useEffect, useState } from "react";
import { canAdmin, useSession } from "../auth/SessionContext";
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  getDriveIntegration,
  updateGoogleDriveRootFolder,
  type DriveIntegrationSummary,
} from "../functions";
import { PageHeader } from "../ui/PageHeader";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CircleAlert, FolderOpen, HardDriveDownload, Link2, ShieldCheck, Unplug } from "lucide-react";

function loadGoogleAccountsScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-accounts="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Accounts script failed to load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleAccounts = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Accounts script failed to load."));
    document.head.appendChild(script);
  });
}

export function StoragePage() {
  const session = useSession();
  const [integration, setIntegration] = useState<DriveIntegrationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rootFolderId, setRootFolderId] = useState("");
  const googleClientId = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID?.trim() ?? "";

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const summary = await getDriveIntegration();
        if (!mounted) return;
        setIntegration(summary);
        setRootFolderId(summary.rootFolderId ?? "");
      } catch (cause) {
        if (!mounted) return;
        setError(cause instanceof Error ? cause.message : "Storage settings could not be loaded.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (!canAdmin(session.role)) {
    return <EmptyState icon={<ShieldCheck />} title="Storage access required" description="Only owners and admins can manage CWMS storage integrations." imageSrc="/visuals/document-vault.jpg" imageAlt="Abstract document vault" />;
  }

  async function refresh() {
    const summary = await getDriveIntegration();
    setIntegration(summary);
    setRootFolderId(summary.rootFolderId ?? "");
  }

  async function startGoogleDriveConnect() {
    if (!googleClientId) {
      setError("VITE_GOOGLE_DRIVE_CLIENT_ID is missing from the web app configuration.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await loadGoogleAccountsScript();
      await new Promise<void>((resolve, reject) => {
        const oauth2 = window.google?.accounts.oauth2;
        if (!oauth2) {
          reject(new Error("Google Accounts client did not initialize."));
          return;
        }
        const client = oauth2.initCodeClient({
          client_id: googleClientId,
          scope: [
            "https://www.googleapis.com/auth/drive",
            "https://www.googleapis.com/auth/userinfo.email",
          ].join(" "),
          ux_mode: "popup",
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: true,
          callback: async (response) => {
            try {
              if (!response.code) throw new Error(response.error_description || response.error || "Google Drive authorization was cancelled.");
              const summary = await connectGoogleDrive({
                code: response.code,
                redirectUri: window.location.origin,
                rootFolderId: rootFolderId.trim() || undefined,
              });
              setIntegration(summary);
              setRootFolderId(summary.rootFolderId ?? "");
              setNotice(`Google Drive connected as ${summary.connectedEmail ?? "your Google account"}.`);
              resolve();
            } catch (cause) {
              reject(cause);
            }
          },
        });
        client.requestCode();
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google Drive could not be connected.");
    } finally {
      setBusy(false);
    }
  }

  async function saveRootFolder() {
    if (!rootFolderId.trim()) {
      setError("Enter a Google Drive folder ID first.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const summary = await updateGoogleDriveRootFolder(rootFolderId.trim());
      setIntegration(summary);
      setNotice("Drive root folder updated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The root folder could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await disconnectGoogleDrive();
      await refresh();
      setNotice("Google Drive disconnected.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google Drive could not be disconnected.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="content-stack">
      <PageHeader
        eyebrow="CWMS storage"
        title="Google Drive storage"
        description="Connect your personal Google Drive, choose the CWMS root folder, and control how managed files flow from workspace to client delivery."
        actions={<Button onPress={startGoogleDriveConnect} isDisabled={busy || !googleClientId}><HardDriveDownload /> {integration?.status === "active" ? "Reconnect Drive" : "Connect Google Drive"}</Button>}
      />

      {error && <div className="data-error" role="alert"><CircleAlert />{error}</div>}
      {notice && <div className="data-success" role="status">{notice}</div>}
      {!loading && integration && (!googleClientId || !integration.requiredConfig.webClientSecret || !integration.requiredConfig.tokenCipherKey) && (
        <div className="data-error" role="alert">
          <CircleAlert />
          Google Drive OAuth is not fully configured for deployment yet. The web app needs `VITE_GOOGLE_DRIVE_CLIENT_ID`, and Firebase Functions need `GOOGLE_DRIVE_OAUTH_CLIENT_ID`, `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET`, and `GOOGLE_DRIVE_TOKEN_CIPHER_KEY`.
        </div>
      )}

      <div className="overview-grid storage-grid">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Connection status</CardTitle>
          </CardHeader>
          <CardContent className="storage-card-body">
            {loading ? <div className="overview-loading">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-10 w-full" />)}</div> : <>
              <div className="storage-stat"><span>Status</span><strong>{integration?.status === "active" ? "Connected" : "Not connected"}</strong></div>
              <div className="storage-stat"><span>Mode</span><strong>{integration?.mode === "personal_oauth" ? "Personal Google Drive" : "Not set"}</strong></div>
              <div className="storage-stat"><span>Account</span><strong>{integration?.connectedEmail ?? "No Google account connected yet"}</strong></div>
              <div className="storage-stat"><span>Connected</span><strong>{integration?.connectedAt ? new Date(integration.connectedAt).toLocaleString() : "Not connected yet"}</strong></div>
              {integration?.status === "active" && <div className="storage-actions">
                <Button variant="outline" onPress={disconnect} isDisabled={busy}><Unplug /> Disconnect</Button>
                {integration.rootFolderUrl && <Button variant="outline" onPress={() => window.open(integration.rootFolderUrl ?? "", "_blank", "noopener,noreferrer")}><FolderOpen /> Open root</Button>}
              </div>}
            </>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Root folder</CardTitle>
          </CardHeader>
          <CardContent className="storage-card-body">
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="drive-root-folder-id">Google Drive folder ID</Label>
                <Input id="drive-root-folder-id" placeholder="1AbCdEf..." value={rootFolderId} onChange={(event) => setRootFolderId(event.target.value)} />
                <small>Leave this blank before first connect if you want CWMS to create a default <strong>SolvingClub CWMS</strong> root automatically.</small>
              </div>
              <Button variant="outline" onPress={saveRootFolder} isDisabled={busy || !integration || integration.status !== "active"}><FolderOpen /> Save root folder</Button>
              {integration?.rootFolderName && <div className="storage-inline-note"><strong>{integration.rootFolderName}</strong><span>{integration.rootFolderUrl}</span></div>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>How CWMS storage works</CardTitle>
        </CardHeader>
        <CardContent className="storage-card-body">
          <div className="storage-checklist">
            <div><Link2 /><span><strong>Workspace-level vault</strong><small>Overview now includes a SolvingClub management vault for internal operations files.</small></span></div>
            <div><Link2 /><span><strong>Scoped uploads</strong><small>Client, project, application, and task documents route into structured folders under your connected root.</small></span></div>
            <div><Link2 /><span><strong>Access levels</strong><small>Every new file or link can stay internal or be marked client-visible for portal sharing.</small></span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default StoragePage;
