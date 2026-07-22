import { useEffect, useRef, useState } from "react";
import { ref, uploadBytes } from "firebase/storage";
import {
  addLinkedDocument, subscribeDocuments,
  type Document, type OwnerType,
} from "@solvingclub/core";
import { db } from "../db";
import { fb } from "../firebase";
import { uploadDocument, deleteDocument } from "../functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CircleAlert, ExternalLink, File as FileIcon, FileText, Link2, Trash2, Upload, X } from "lucide-react";
import { ConfirmAction } from "../ui/ConfirmAction";
import { Skeleton } from "@/components/ui/skeleton";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

function safeHref(url: string): string {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "https:" || protocol === "http:" ? url : "#";
  } catch { return "#"; }
}

export function Documents(
  { ownerType, ownerId, clientId, canEdit }:
  { ownerType: OwnerType; ownerId: string; clientId: string; canEdit: boolean },
) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    return subscribeDocuments(db, ownerId, (items) => {
      setDocs(items); setError(null); setLoading(false);
    }, () => { setError("Documents could not be loaded. Refresh to try again."); setLoading(false); });
  }, [ownerId]);

  async function onAddLink(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !url.trim()) return;
    setError(null);
    try {
      await addLinkedDocument(db, {
        label: label.trim(), url: url.trim(), ownerType, ownerId, clientId,
        uploadedBy: fb.auth.currentUser?.uid ?? "unknown",
      });
      setLabel(""); setUrl(""); setShowLinkForm(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The link could not be attached.");
    }
  }

  async function upload(file: File) {
    if (file.size >= MAX_FILE_BYTES) { setError("Choose a file smaller than 25 MB."); return; }
    if (!file.name.trim()) { setError("The selected file needs a valid name."); return; }
    setError(null); setUploading(true);
    try {
      const uid = fb.auth.currentUser?.uid ?? "unknown";
      const storagePath = `staging/${uid}/${file.name}`;
      await uploadBytes(ref(fb.storage, storagePath), file);
      await uploadDocument({
        storagePath, fileName: file.name, mimeType: file.type || "application/octet-stream",
        label: file.name, ownerType, ownerId,
      });
    } catch (cause) {
      setError(cause instanceof Error ? `Upload failed: ${cause.message}` : "Upload failed. Attach a link instead.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="documents-panel">
      <div className="documents-toolbar"><div><FileText /><span>{docs.length} item{docs.length === 1 ? "" : "s"}</span></div>{canEdit && <div><Button variant="outline" size="sm" onPress={() => setShowLinkForm((value) => !value)}>{showLinkForm ? <X /> : <Link2 />}{showLinkForm ? "Close" : "Attach link"}</Button><Button size="sm" onPress={() => fileInputRef.current?.click()} isDisabled={uploading}><Upload />{uploading ? "Uploading…" : "Upload file"}</Button></div>}</div>

      {ownerType === "client" && <div className="document-visual"><img src="/visuals/document-vault.jpg" alt="Abstract managed document vault" loading="lazy" /><span><strong>Managed file vault</strong><small>Files move from secure staging into the client’s organized Drive workspace.</small></span></div>}

      {canEdit && showLinkForm && <form onSubmit={onAddLink} className="document-link-form"><Input aria-label="Document label" placeholder="Link label" value={label} onChange={(e) => setLabel(e.target.value)} /><Input aria-label="Document URL" type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} /><Button type="submit" isDisabled={!label.trim() || !url.trim()}>Attach link</Button></form>}

      {canEdit && <div className={`document-dropzone${dragging ? " dragging" : ""}${uploading ? " uploading" : ""}`}
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }} onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) void upload(file); }}>
        <Upload /><span><strong>{uploading ? "Moving file to managed Drive…" : "Drop a file here"}</strong><small>or use Upload file · 25 MB maximum</small></span>
        <Input ref={fileInputRef} aria-label="Choose file" type="file" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} disabled={uploading} className="sr-only" />
      </div>}

      {error && <div className="data-error" role="alert"><CircleAlert />{error}</div>}
      {loading ? <div className="document-loading">{[1,2].map((item) => <Skeleton key={item} className="h-12 w-full" />)}</div> : docs.length === 0 ? <div className="document-empty">{ownerType !== "client" && <img src="/visuals/document-vault.jpg" alt="" aria-hidden="true" loading="lazy" />}<FileIcon /> <span><strong>No documents yet</strong><small>{canEdit ? "Upload a file or attach a link to keep context with the work." : "Shared files and links will appear here."}</small></span></div> : <div className="document-list">{docs.map((document) => (
        <div className="document-row" key={document.id}>
          <span className="document-type-icon">{document.kind === "managed" ? <FileText /> : <Link2 />}</span>
          <span className="document-copy"><strong>{document.label}</strong><small>{document.kind === "managed" ? document.mimeType ?? "Managed file" : "External link"}</small></span>
          {document.kind === "managed" && <Badge variant="secondary">Drive</Badge>}
          <a className="document-open" href={safeHref(document.url)} target="_blank" rel="noreferrer" aria-label={`Open ${document.label}`}><ExternalLink /></a>
          {canEdit && <ConfirmAction title={`Remove ${document.label}?`} description={document.kind === "managed" ? "This permanently removes the file from managed Drive storage and this workspace." : "This removes the link from this workspace."} confirmLabel="Remove" trigger={<Button aria-label={`Remove ${document.label}`} variant="ghost" size="icon-sm" className="text-destructive"><Trash2 /></Button>} onConfirm={async () => { await deleteDocument({ id: document.id }); }} />}
        </div>
      ))}</div>}
    </div>
  );
}
