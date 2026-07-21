import { z } from "zod";

export const applicationSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  clientId: z.string().min(1),
  name: z.string().min(1),
  type: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["active", "archived"]).default("active"),
  driveFolderId: z.string().optional(),
  createdAt: z.number(),
});

export type Application = z.infer<typeof applicationSchema>;

export function parseApplication(input: unknown): Application {
  return applicationSchema.parse(input);
}
