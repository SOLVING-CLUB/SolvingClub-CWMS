import { onDocumentUpdated, onDocumentCreated } from "firebase-functions/v2/firestore";
import { db } from "./admin.js";

// Sentinel matching packages/core's ORG_BROADCAST — a member notification
// with this recipientId is delivered to every org member.
const ORG_BROADCAST = "org";

/** Notifies the owning client whenever a task's status changes. */
export const onTaskStatusChanged = onDocumentUpdated("tasks/{taskId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.status === after.status) return;

  await db.collection("notifications").add({
    recipientType: "client",
    recipientId: after.clientId,
    title: `Task "${after.title}" is now ${after.status}`,
    link: `/clients/${after.clientId}/apps/${after.applicationId}`,
    read: false,
    createdAt: Date.now(),
  });
});

/** Notifies the other side (client -> whole org, member -> the client) of a new comment. */
export const onCommentCreated = onDocumentCreated("comments/{commentId}", async (event) => {
  const data = event.data?.data();
  if (!data) return;

  const taskSnap = await db.doc(`tasks/${data.taskId}`).get();
  const taskTitle = taskSnap.exists ? (taskSnap.get("title") as string) : "a task";

  if (data.authorType === "client") {
    await db.collection("notifications").add({
      recipientType: "member",
      recipientId: ORG_BROADCAST,
      title: `New client comment on "${taskTitle}"`,
      link: `/clients/${data.clientId}`,
      read: false,
      createdAt: Date.now(),
    });
  } else {
    await db.collection("notifications").add({
      recipientType: "client",
      recipientId: data.clientId,
      title: `New comment on "${taskTitle}"`,
      read: false,
      createdAt: Date.now(),
    });
  }
});
