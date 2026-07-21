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
    <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: "2px solid #eee" }}>
      <ul style={{ margin: "4px 0" }}>
        {comments.map((c) => (
          <li key={c.id}><strong>{c.authorType}</strong>: {c.body}</li>
        ))}
        {comments.length === 0 && <li style={{ color: "#999" }}>No comments yet.</li>}
      </ul>
      <form onSubmit={onAdd} style={{ display: "flex", gap: 8 }}>
        <input placeholder="Add a comment" value={body} onChange={(e) => setBody(e.target.value)} />
        <button type="submit">Comment</button>
      </form>
    </div>
  );
}
