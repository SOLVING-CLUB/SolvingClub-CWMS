import { useEffect, useState } from "react";
import { addComment, listComments, type Comment } from "@solvingclub/core";
import { db } from "../db";
import { fb } from "../firebase";

export function Comments(
  { taskId, clientId, authorType }: { taskId: string; clientId: string; authorType: "member" | "client" },
) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");

  async function refresh() { setComments(await listComments(db, taskId)); }
  useEffect(() => { refresh(); }, [taskId]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    await addComment(db, {
      taskId, clientId,
      authorUid: fb.auth.currentUser?.uid ?? "unknown",
      authorType, body: body.trim(),
    });
    setBody(""); await refresh();
  }

  return (
    <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: "2px solid var(--line-strong)" }}>
      <div className="eyebrow">Discussion</div>
      {comments.length === 0 ? (
        <p className="empty-state" style={{ margin: "0 0 8px" }}>No comments yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
          {comments.map((c) => (
            <div key={c.id} style={{ fontSize: 13 }}>
              <span className="mono muted" style={{ fontSize: 10, textTransform: "uppercase", marginRight: 6 }}>
                {c.authorType}
              </span>
              {c.body}
            </div>
          ))}
        </div>
      )}
      <form onSubmit={onAdd} className="form-row">
        <input placeholder="Add a comment" value={body} onChange={(e) => setBody(e.target.value)} style={{ flex: 1 }} />
        <button type="submit">Comment</button>
      </form>
    </div>
  );
}
