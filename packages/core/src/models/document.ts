import { z } from "zod";

export const documentKindSchema = z.enum(["managed", "linked"]);
export type DocumentKind = z.infer<typeof documentKindSchema>;

export const ownerTypeSchema = z.enum(["client", "project", "application", "task"]);
export type OwnerType = z.infer<typeof ownerTypeSchema>;

export const documentSchema = z.object({
  id: z.string().min(1),
  kind: documentKindSchema,
  label: z.string().min(1),
  url: z.string().url(),
  driveFileId: z.string().optional(),
  mimeType: z.string().optional(),
  ownerType: ownerTypeSchema,
  ownerId: z.string().min(1),
  clientId: z.string().min(1),
  uploadedBy: z.string().min(1),
  createdAt: z.number(),
});

export type Document = z.infer<typeof documentSchema>;

export function parseDocument(input: unknown): Document {
  return documentSchema.parse(input);
}
