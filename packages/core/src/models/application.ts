import { z } from "zod";

export const applicationSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  clientId: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  type: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(4000).optional(),
  status: z.enum(["active", "archived"]).default("active"),
  driveFolderId: z.string().optional(),
  createdAt: z.number(),
});

export type Application = z.infer<typeof applicationSchema>;

export function parseApplication(input: unknown): Application {
  return applicationSchema.parse(input);
}
