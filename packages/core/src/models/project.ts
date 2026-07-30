import { z } from "zod";
import { projectTypeSchema } from "./enums";

/** One technology name, e.g. "React" or "Postgres". */
export const techStackEntrySchema = z.string().trim().min(1).max(40);

export const projectSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).optional(),
  status: z.enum(["active", "archived"]).default("active"),
  // Every field below is optional on purpose: projects created before these
  // existed must still parse on read.
  type: projectTypeSchema.optional(),
  startDate: z.number().optional(),
  techStack: z.array(techStackEntrySchema).max(24).optional(),
  driveFolderId: z.string().optional(),
  createdAt: z.number(),
});

export type Project = z.infer<typeof projectSchema>;

export function parseProject(input: unknown): Project {
  return projectSchema.parse(input);
}
