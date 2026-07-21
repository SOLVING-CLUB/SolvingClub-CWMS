import { useEffect, useRef, useState } from "react";
import { ref, uploadBytes } from "firebase/storage";
import {
  addLinkedDocument, listDocuments, deleteDocument,
  type Document, type OwnerType,
} from "@solvingclub/core";
import { db } from "../db";
import { fb } from "../firebase";
import { uploadDocument } from "../functions";

// Defense-in-depth: even though the schema rejects non-http(s) URLs at write
// time, never render a stored `url` as href without re-checking its scheme.
function safeHref(url: string): string {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "https:" || protocol === "http:" ? url : "#";
  } catch {
    return "#";
  }
}

export function Documents(
  { ownerType, ownerId, clientId, canEdit }:
  { ownerType: OwnerType; ownerId: string; clientId: string; canEdit: boolean },
) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() { setDocs(await listDocuments(db, ownerId)); }
  useEffect(() => { refresh(); }, [ownerId]);

  async function onAddLink(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !url.trim()) return;
    await addLinkedDocument(db, {
      label: label.trim(), url: url.trim(), ownerType, ownerId, clientId,
      uploadedBy: fb.auth.currentUser?.uid ?? "unknown",
    });
    setLabel(""); setUrl(""); await refresh();
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const uid = fb.auth.currentUser?.uid ?? "unknown";
      const storagePath = `staging/${uid}/${file.name}`;
      await uploadBytes(ref(fb.storage, storagePath), file);
      await uploadDocument({
        storagePath, fileName: file.name, mimeType: file.type || "application/octet-stream",
        label: file.name, ownerType, ownerId,
      });
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? `Upload to Drive failed: ${err.message}. You can attach a link instead.`
          : "Upload failed.",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div style={{ marginTop: 4 }}>
      <em>Documents</em>
      <ul style={{ margin: "4px 0" }}>
        {docs.map((d) => (
          <li key={d.id}>
            <a href={safeHref(d.url)} target="_blank" rel="noreferrer">{d.label}</a>
            {d.kind === "managed" && <span style={{ color: "#999" }}> (Drive)</span>}
            {canEdit && (
              <> <button onClick={async () => { await deleteDocument(db, d.id); await refresh(); }}>remove</button></>
            )}
          </li>
        ))}
        {docs.length === 0 && <li style={{ color: "#999" }}>No documents.</li>}
      </ul>
      {canEdit && (
        <>
          <form onSubmit={onAddLink} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
            <input placeholder="Drive / file URL" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button type="submit">Attach link</button>
          </form>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input ref={fileInputRef} type="file" onChange={onFileChosen} disabled={uploading} />
            {uploading && <span>Uploading…</span>}
          </div>
          {error && <p role="alert">{error}</p>}
        </>
      )}
    </div>
  );
}
