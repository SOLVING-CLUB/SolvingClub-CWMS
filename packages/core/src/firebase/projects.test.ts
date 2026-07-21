import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestEnv, seedMember, memberDb } from "./testEnv";
import { createProject, listProjectsByClient, updateProject, deleteProject } from "./projects";
import { createApplication, listApplicationsByProject } from "./applications";

describe("project & application data-access (as member)", () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedMember("u1");
  });
  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it("creates, lists, updates, and deletes a project", async () => {
    const db = await memberDb("u1");
    const p = await createProject(db, { clientId: "c1", name: "Site" });
    expect(p.id).toBeTruthy();
    expect(p.status).toBe("active");

    let all = await listProjectsByClient(db, "c1");
    expect(all).toHaveLength(1);

    await updateProject(db, p.id, { name: "New Site" });
    all = await listProjectsByClient(db, "c1");
    expect(all[0].name).toBe("New Site");

    await deleteProject(db, p.id);
    all = await listProjectsByClient(db, "c1");
    expect(all).toHaveLength(0);
  });

  it("creates and lists an application under a project", async () => {
    const db = await memberDb("u1");
    const app = await createApplication(db, { projectId: "p1", clientId: "c1", name: "API" });
    expect(app.id).toBeTruthy();
    const apps = await listApplicationsByProject(db, "p1");
    expect(apps).toHaveLength(1);
    expect(apps[0].name).toBe("API");
  });
});
