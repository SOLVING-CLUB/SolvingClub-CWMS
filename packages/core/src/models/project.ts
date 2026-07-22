import { z } from "zod";

export const projectSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).optional(),
  status: z.enum(["active", "archived"]).default("active"),
  driveFolderId: z.string().optional(),
  createdAt: z.number(),
});

export type Project = z.infer<typeof projectSchema>;

export function parseProject(input: unknown): Project {
  return projectSchema.parse(input);
}
