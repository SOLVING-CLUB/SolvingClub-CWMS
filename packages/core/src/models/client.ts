import { z } from "zod";

export const clientSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  driveFolderId: z.string().optional(),
  status: z.enum(["active", "archived"]).default("active"),
  createdAt: z.number(),
});

export type Client = z.infer<typeof clientSchema>;

export function parseClient(input: unknown): Client {
  return clientSchema.parse(input);
}
