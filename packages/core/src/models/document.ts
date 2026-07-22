import { z } from "zod";

export const documentKindSchema = z.enum(["managed", "linked"]);
export type DocumentKind = z.infer<typeof documentKindSchema>;

export const ownerTypeSchema = z.enum(["client", "project", "application", "task"]);
export type OwnerType = z.infer<typeof ownerTypeSchema>;

// Restrict to http(s) so a stored javascript: URL can never be rendered
// as a clickable href (linked documents accept an arbitrary user-supplied URL).
const httpUrlSchema = z.string().url().refine((u) => {
  try {
    const protocol = new URL(u).protocol;
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}, "Only http(s) URLs are allowed");

export const documentSchema = z.object({
  id: z.string().min(1),
  kind: documentKindSchema,
  label: z.string().min(1),
  url: httpUrlSchema,
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
