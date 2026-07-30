import { onDocumentUpdated, onDocumentCreated } from "firebase-functions/v2/firestore";
import { db } from "./admin.js";

function clientDeliveryLink() {
  return "/#delivery";
}

function memberApplicationLink(clientId: string, applicationId: string) {
  return `/applications/${clientId}/${applicationId}`;
}

/** Keeps the client informed as soon as the delivery team adds a new task. */
export const onTaskCreated = onDocumentCreated("tasks/{taskId}", async (event) => {
  const task = event.data?.data();
  if (!task?.clientId || !task?.applicationId || !task?.title) return;

  const batch = db.batch();
  batch.set(db.collection("notifications").doc(), {
    recipientType: "client", recipientId: task.clientId,
    title: `New task: “${task.title}”`,
    body: "A delivery task was added to your workspace.",
    link: clientDeliveryLink(),
    read: false, createdAt: Date.now(),
  });

  if (typeof task.assigneeUid === "string" && task.assigneeUid) {
    const assignee = await db.doc(`members/${task.assigneeUid}`).get();
    if (assignee.exists && assignee.get("status") === "active") {
      batch.set(db.collection("notifications").doc(), {
        recipientType: "member", recipientId: task.assigneeUid,
        title: `You were assigned “${task.title}”`,
        body: "A new delivery task is ready for you.",
        link: memberApplicationLink(task.clientId, task.applicationId),
        read: false, createdAt: Date.now(),
      });
    }
  }
  await batch.commit();
});

/** Alerts an active member when delivery work is assigned or reassigned to them. */
export const onTaskAssigneeChanged = onDocumentUpdated("tasks/{taskId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.assigneeUid === after.assigneeUid || !after.assigneeUid) return;

  const assignee = await db.doc(`members/${after.assigneeUid}`).get();
  if (!assignee.exists || assignee.get("status") !== "active") return;
  await db.collection("notifications").add({
    recipientType: "member", recipientId: after.assigneeUid,
    title: `Task assigned: “${after.title}”`,
    body: "You have a new delivery responsibility.",
    link: memberApplicationLink(after.clientId, after.applicationId),
    read: false, createdAt: Date.now(),
  });
});

/** Keeps the client informed when an invoice is issued, paid, overdue, or voided. */
export const onInvoiceStatusChanged = onDocumentUpdated("invoices/{invoiceId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.status === after.status || after.status === "draft") return;

  const labels: Record<string, string> = {
    sent: "is ready for review",
    paid: "has been marked as paid",
    overdue: "is now overdue",
    void: "has been voided",
  };
  const label = labels[String(after.status)];
  if (!label || !after.clientId || !after.number) return;
  const total = typeof after.total === "number" ? `${after.currency ?? "USD"} ${after.total.toFixed(2)}` : "";
  await db.collection("notifications").add({
    recipientType: "client", recipientId: after.clientId,
    title: `Invoice ${after.number} ${label}`,
    body: total ? `Invoice total: ${total}. Open billing to review the details.` : "Open billing to review the details.",
    link: "/#invoices",
    read: false, createdAt: Date.now(),
  });
});

/** Notifies the owning client whenever a task's status changes. */
export const onTaskStatusChanged = onDocumentUpdated("tasks/{taskId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.status === after.status) return;

  const statusLabel = String(after.status).replaceAll("_", " ");
  await db.collection("notifications").add({
    recipientType: "client",
    recipientId: after.clientId,
    title: `Task “${after.title}” is now ${statusLabel}`,
    body: "Open the delivery workspace to review the latest status and conversation.",
    link: clientDeliveryLink(),
    read: false,
    createdAt: Date.now(),
  });
});

/** Notifies the other side of a new comment. Member alerts are recipient-specific. */
export const onCommentCreated = onDocumentCreated("comments/{commentId}", async (event) => {
  const data = event.data?.data();
  if (!data) return;

  const taskSnap = await db.doc(`tasks/${data.taskId}`).get();
  const taskTitle = taskSnap.exists ? (taskSnap.get("title") as string) : "a task";
  const applicationId = taskSnap.exists ? (taskSnap.get("applicationId") as string | undefined) : undefined;
  const clientTaskLink = applicationId ? clientDeliveryLink() : "/#overview";
  const memberTaskLink = applicationId ? memberApplicationLink(data.clientId, applicationId) : `/clients/${data.clientId}`;

  if (data.authorType === "client") {
    const members = await db.collection("members").where("status", "==", "active").get();
    const batch = db.batch();
    for (const member of members.docs) {
      batch.set(db.collection("notifications").doc(), {
        recipientType: "member", recipientId: member.id,
        title: `New client comment on “${taskTitle}”`,
        body: "A client added context to the delivery conversation.",
        link: memberTaskLink,
        read: false, createdAt: Date.now(),
      });
    }
    await batch.commit();
  } else {
    await db.collection("notifications").add({
      recipientType: "client",
      recipientId: data.clientId,
      title: `New comment on “${taskTitle}”`,
      body: "Your delivery team replied to the task conversation.",
      link: clientTaskLink,
      read: false,
      createdAt: Date.now(),
    });
  }
});
