import { z } from "zod";

export const commentSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  clientId: z.string().min(1),
  authorUid: z.string().min(1),
  authorType: z.enum(["member", "client"]),
  body: z.string().trim().min(1).max(4000),
  createdAt: z.number(),
});

export type Comment = z.infer<typeof commentSchema>;

export function parseComment(input: unknown): Comment {
  return commentSchema.parse(input);
}
