import { z } from "zod";
import { roleSchema, memberStatusSchema } from "./enums";

export const memberSchema = z.object({
  uid: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  role: roleSchema,
  status: memberStatusSchema,
  createdAt: z.number(),
});

export type Member = z.infer<typeof memberSchema>;

export function parseMember(input: unknown): Member {
  return memberSchema.parse(input);
}
