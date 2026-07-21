import { useEffect, useState } from "react";
import {
  addLinkedDocument, listDocuments, deleteDocument,
  type Document, type OwnerType,
} from "@solvingclub/core";
import { db } from "../db";
import { fb } from "../firebase";

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

  async function refresh() { setDocs(await listDocuments(db, ownerId)); }
  useEffect(() => { refresh(); }, [ownerId]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !url.trim()) return;
    await addLinkedDocument(db, {
      label: label.trim(), url: url.trim(), ownerType, ownerId, clientId,
      uploadedBy: fb.auth.currentUser?.uid ?? "unknown",
    });
    setLabel(""); setUrl(""); await refresh();
  }

  return (
    <div style={{ marginTop: 4 }}>
      <em>Documents</em>
      <ul style={{ margin: "4px 0" }}>
        {docs.map((d) => (
          <li key={d.id}>
            <a href={safeHref(d.url)} target="_blank" rel="noreferrer">{d.label}</a>
            {canEdit && (
              <> <button onClick={async () => { await deleteDocument(db, d.id); await refresh(); }}>remove</button></>
            )}
          </li>
        ))}
        {docs.length === 0 && <li style={{ color: "#999" }}>No documents.</li>}
      </ul>
      {canEdit && (
        <form onSubmit={onAdd} style={{ display: "flex", gap: 8 }}>
          <input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input placeholder="Drive / file URL" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button type="submit">Attach link</button>
        </form>
      )}
    </div>
  );
}
