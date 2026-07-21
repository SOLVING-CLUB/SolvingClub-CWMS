import { z } from "zod";

export const notificationRecipientTypeSchema = z.enum(["member", "client"]);
export type NotificationRecipientType = z.infer<typeof notificationRecipientTypeSchema>;

export const notificationSchema = z.object({
  id: z.string().min(1),
  recipientType: notificationRecipientTypeSchema,
  // For recipientType "client": a clientId. For "member": a member uid, or
  // the sentinel "org" meaning every member (e.g. a client left a comment).
  recipientId: z.string().min(1),
  title: z.string().min(1),
  body: z.string().optional(),
  link: z.string().optional(),
  read: z.boolean().default(false),
  createdAt: z.number(),
});

export type Notification = z.infer<typeof notificationSchema>;

export function parseNotification(input: unknown): Notification {
  return notificationSchema.parse(input);
}
