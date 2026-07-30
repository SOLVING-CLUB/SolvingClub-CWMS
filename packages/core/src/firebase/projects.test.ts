import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestEnv, seedMember, seedClient, memberDb } from "./testEnv";
import { createProject, listProjects, listProjectsByClient, subscribeProjectsByClient, updateProject, deleteProject } from "./projects";
import { createApplication, listApplications, listApplicationsByProject, subscribeApplicationsByProject, updateApplication } from "./applications";

describe("project & application data-access (as member)", () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedMember("u1");
    await seedClient();
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

  it("stores a project's type, start date, and tech stack under real rules", async () => {
    const db = await memberDb("u1");
    const startDate = Date.UTC(2026, 0, 15);
    const created = await createProject(db, {
      clientId: "c1", name: "Delivery app", type: "mobile_app",
      startDate, techStack: ["React Native", "Firebase"],
    });
    expect(created.type).toBe("mobile_app");

    const [stored] = await listProjectsByClient(db, "c1");
    expect(stored.type).toBe("mobile_app");
    expect(stored.startDate).toBe(startDate);
    expect(stored.techStack).toEqual(["React Native", "Firebase"]);
  });

  it("can change and clear a project's type, start date, and tech stack", async () => {
    const db = await memberDb("u1");
    const project = await createProject(db, {
      clientId: "c1", name: "Portal", type: "web_app", startDate: 1, techStack: ["React"],
    });
    await updateProject(db, project.id, { type: "desktop_app", techStack: ["Electron", "SQLite"] });
    let [updated] = await listProjectsByClient(db, "c1");
    expect(updated.type).toBe("desktop_app");
    expect(updated.techStack).toEqual(["Electron", "SQLite"]);

    await updateProject(db, project.id, { type: null, startDate: null, techStack: null });
    [updated] = await listProjectsByClient(db, "c1");
    expect(updated.type).toBeUndefined();
    expect(updated.startDate).toBeUndefined();
    expect(updated.techStack).toBeUndefined();
  });

  it("rejects an unknown project type and an oversized tech stack", async () => {
    const db = await memberDb("u1");
    await expect(createProject(db, {
      clientId: "c1", name: "Bad type", type: "spaceship" as never,
    })).rejects.toThrow();
    await expect(createProject(db, {
      clientId: "c1", name: "Too many", techStack: Array.from({ length: 25 }, (_, index) => `Tool ${index}`),
    })).rejects.toThrow();
  });

  it("creates and lists an application under a project", async () => {
    const db = await memberDb("u1");
    const project = await createProject(db, { clientId: "c1", name: "Platform" });
    const app = await createApplication(db, { projectId: project.id, clientId: "c1", name: "API" });
    expect(app.id).toBeTruthy();
    const apps = await listApplicationsByProject(db, project.id);
    expect(apps).toHaveLength(1);
    expect(apps[0].name).toBe("API");
    expect(await listProjects(db)).toHaveLength(1);
    expect(await listApplications(db)).toHaveLength(1);
  });

  it("rejects invalid project and application updates before writing", async () => {
    const db = await memberDb("u1");
    const project = await createProject(db, { clientId: "c1", name: "Validated" });
    const application = await createApplication(db, { projectId: project.id, clientId: "c1", name: "Validated app" });
    await expect(updateProject(db, project.id, { name: " " })).rejects.toThrow();
    await expect(updateProject(db, project.id, { description: "x".repeat(4001) })).rejects.toThrow();
    await expect(updateApplication(db, application.id, { type: " " })).rejects.toThrow();
    await expect(updateApplication(db, application.id, { name: "x".repeat(161) })).rejects.toThrow();
  });

  it("can clear optional application fields", async () => {
    const db = await memberDb("u1");
    const project = await createProject(db, { clientId: "c1", name: "Platform" });
    const application = await createApplication(db, { projectId: project.id, clientId: "c1", name: "API", type: "Backend", description: "Build API" });
    await updateApplication(db, application.id, { type: null, description: null });
    const [updated] = await listApplicationsByProject(db, project.id);
    expect(updated).toMatchObject({ name: "API" });
    expect(updated.type).toBeUndefined();
    expect(updated.description).toBeUndefined();
  });

  it("keeps project and application collections synchronized", async () => {
    const db = await memberDb("u1");
    const projectReceived = new Promise<void>((resolve, reject) => {
      let unsubscribe = () => {};
      const timeout = setTimeout(() => { unsubscribe(); reject(new Error("Project subscription timed out")); }, 5000);
      unsubscribe = subscribeProjectsByClient(db, "c1", (items) => {
        if (!items.some((item) => item.name === "Live project")) return;
        clearTimeout(timeout); unsubscribe(); resolve();
      }, reject);
    });
    const project = await createProject(db, { clientId: "c1", name: "Live project" });
    await projectReceived;

    const applicationReceived = new Promise<void>((resolve, reject) => {
      let unsubscribe = () => {};
      const timeout = setTimeout(() => { unsubscribe(); reject(new Error("Application subscription timed out")); }, 5000);
      unsubscribe = subscribeApplicationsByProject(db, project.id, "c1", (items) => {
        if (!items.some((item) => item.name === "Live application")) return;
        clearTimeout(timeout); unsubscribe(); resolve();
      }, reject);
    });
    await createApplication(db, { projectId: project.id, clientId: "c1", name: "Live application" });
    await applicationReceived;
  });
});
