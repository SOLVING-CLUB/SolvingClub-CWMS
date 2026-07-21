import { z } from "zod";
import { taskStatusSchema } from "./enums";

export const taskSchema = z.object({
  id: z.string().min(1),
  applicationId: z.string().min(1),
  projectId: z.string().min(1),
  clientId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  status: taskStatusSchema,
  priority: z.number(),
  order: z.number(),
  assigneeUid: z.string().optional(),
  dueDate: z.number().optional(),
  createdBy: z.string().min(1),
  createdAt: z.number(),
});

export type Task = z.infer<typeof taskSchema>;

export function parseTask(input: unknown): Task {
  return taskSchema.parse(input);
}
