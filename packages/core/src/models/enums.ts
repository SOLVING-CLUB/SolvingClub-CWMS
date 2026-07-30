import { z } from "zod";

export const roleSchema = z.enum(["owner", "admin", "member"]);
export type Role = z.infer<typeof roleSchema>;

export const memberStatusSchema = z.enum(["active", "invited", "disabled"]);
export type MemberStatus = z.infer<typeof memberStatusSchema>;

export const taskStatusSchema = z.enum(["todo", "in_progress", "blocked", "done"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const projectTypeSchema = z.enum([
  "web_app", "mobile_app", "desktop_app", "website",
  "api_service", "ai_ml", "data_platform", "automation", "other",
]);
export type ProjectType = z.infer<typeof projectTypeSchema>;

/** Shared so the label reads identically on every surface that shows a project. */
export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  web_app: "Web app",
  mobile_app: "Mobile app",
  desktop_app: "Desktop app",
  website: "Website",
  api_service: "API / service",
  ai_ml: "AI / ML",
  data_platform: "Data platform",
  automation: "Automation",
  other: "Other",
};

export function projectTypeLabel(type: ProjectType | undefined): string {
  return type ? PROJECT_TYPE_LABELS[type] : "Unspecified";
}
