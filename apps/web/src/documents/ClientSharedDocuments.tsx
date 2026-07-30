import { useEffect, useState } from "react";
import { subscribeDocumentsByClient, type Document } from "@solvingclub/core";
import { CircleAlert, ExternalLink, File as FileIcon, FileText, Link2 } from "lucide-react";
import { db } from "../db";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const OWNER_LABEL: Record<Document["ownerType"], string> = {
  workspace: "Workspace",
  client: "Client workspace",
  project: "Project",
  application: "Application",
  task: "Task",
};

function safeHref(url: string): string {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "https:" || protocol === "http:" ? url : "#";
  } catch { return "#"; }
}

export function ClientSharedDocuments({ clientId }: { clientId: string }) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true); setError(false);
    return subscribeDocumentsByClient(db, clientId, (items) => {
      setDocuments(items); setLoading(false);
    }, () => { setError(true); setLoading(false); });
  }, [clientId]);

  return <div className="documents-panel client-shared-documents">
    <div className="document-visual"><img src="/visuals/document-vault.jpg" alt="Abstract managed document vault" loading="lazy" /><span><strong>Shared document vault</strong><small>Files and links from your client workspace, projects, applications, and delivery tasks.</small></span></div>
    {error && <div className="data-error" role="alert"><CircleAlert /> Documents could not be loaded. Refresh to try again.</div>}
    {loading ? <div className="document-loading">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-12 w-full" />)}</div> : documents.length === 0 ? <div className="document-empty"><FileIcon /><span><strong>No shared documents yet</strong><small>Files and links shared with your work will appear here.</small></span></div> : <div className="document-list">{documents.map((document) => <div className="document-row" key={document.id}>
      <span className="document-type-icon">{document.kind === "managed" ? <FileText /> : <Link2 />}</span>
      <span className="document-copy"><strong>{document.label}</strong><small>{OWNER_LABEL[document.ownerType]} · {document.kind === "managed" ? document.mimeType ?? "Managed file" : "External link"}</small></span>
      <Badge variant="secondary">{document.kind === "managed" ? "Drive" : "Link"}</Badge>
      <a className="document-open" href={safeHref(document.url)} target="_blank" rel="noreferrer" aria-label={`Open ${document.label}`}><ExternalLink /></a>
    </div>)}</div>}
  </div>;
}
