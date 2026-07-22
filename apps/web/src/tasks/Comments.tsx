import { useEffect, useState } from "react";
import { addComment, subscribeComments, type Comment } from "@solvingclub/core";
import { db } from "../db";
import { fb } from "../firebase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Send } from "lucide-react";

function relativeTime(timestamp: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function Comments(
  { taskId, clientId, authorType }: { taskId: string; clientId: string; authorType: "member" | "client" },
) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    return subscribeComments(db, taskId, (nextComments) => {
      setComments(nextComments); setLoading(false); setError(null);
    }, () => {
      setLoading(false); setError("Live conversation updates are unavailable. Reopen the task to retry.");
    });
  }, [taskId]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const message = body.trim();
    if (!message || message.length > 4000) return;
    setBusy(true); setError(null);
    try {
      await addComment(db, {
        taskId, clientId,
        authorUid: fb.auth.currentUser?.uid ?? "unknown",
        authorType, body: message,
      });
      setBody("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The comment could not be posted.");
    } finally { setBusy(false); }
  }

  return (
    <section className="discussion" aria-label="Task conversation">
      <header className="discussion-header"><span><MessageSquare /> Conversation</span><small>{comments.length} message{comments.length === 1 ? "" : "s"}</small></header>
      {loading ? <div className="discussion-loading"><Skeleton className="h-14 w-4/5" /><Skeleton className="h-14 w-3/4" /></div> : comments.length === 0 ? (
        <div className="discussion-empty"><MessageSquare /><span><strong>Start the conversation</strong><small>Share context, decisions, or a delivery update here.</small></span></div>
      ) : (
        <div className="discussion-thread">
          {comments.map((comment) => {
            const isClient = comment.authorType === "client";
            const label = isClient ? "Client" : "Solving Club";
            return <article key={comment.id} className={`discussion-message ${isClient ? "client" : "member"}`}>
              <span className="discussion-avatar" aria-hidden="true">{isClient ? "CL" : "SC"}</span>
              <div><header><strong>{label}</strong><time dateTime={new Date(comment.createdAt).toISOString()} title={new Date(comment.createdAt).toLocaleString()}>{relativeTime(comment.createdAt)}</time></header><p>{comment.body}</p></div>
            </article>;
          })}
        </div>
      )}
      <form onSubmit={onAdd} className="discussion-compose">
        <Textarea aria-label="Add a message" placeholder="Write a message…" value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} />
        <footer><small className={body.length > 3800 ? "near-limit" : ""}>{body.length.toLocaleString()} / 4,000</small><Button type="submit" size="sm" isDisabled={busy || !body.trim()}>{busy ? "Posting…" : <><Send /> Send message</>}</Button></footer>
      </form>
      {error && <p role="alert" className="form-error">{error}</p>}
    </section>
  );
}
