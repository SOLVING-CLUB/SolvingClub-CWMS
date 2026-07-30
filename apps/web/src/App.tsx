import { lazy, Suspense, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { fb } from "./firebase";
import { getMember } from "@solvingclub/core";
import { SessionProvider, type Session } from "./auth/SessionContext";

const LoginPage = lazy(() => import("./auth/LoginPage").then((module) => ({ default: module.LoginPage })));
const Shell = lazy(() => import("./ui/Shell").then((module) => ({ default: module.Shell })));
const ClientsPage = lazy(() => import("./clients/ClientsPage").then((module) => ({ default: module.ClientsPage })));
const ClientDetailPage = lazy(() => import("./clients/ClientDetailPage").then((module) => ({ default: module.ClientDetailPage })));
const ClientDetailsPage = lazy(() => import("./clients/ClientDetailsPage").then((module) => ({ default: module.ClientDetailsPage })));
const TasksPage = lazy(() => import("./tasks/TasksPage").then((module) => ({ default: module.TasksPage })));
const ClientPortal = lazy(() => import("./portal/ClientPortal").then((module) => ({ default: module.ClientPortal })));
const OverviewPage = lazy(() => import("./dashboard/OverviewPage").then((module) => ({ default: module.OverviewPage })));
const WorkspaceTasksPage = lazy(() => import("./tasks/WorkspaceTasksPage").then((module) => ({ default: module.WorkspaceTasksPage })));
const AccessDenied = lazy(() => import("./auth/AccessDenied").then((module) => ({ default: module.AccessDenied })));
const MembersPage = lazy(() => import("./members/MembersPage").then((module) => ({ default: module.MembersPage })));
const ProjectsPage = lazy(() => import("./projects/ProjectsPage").then((module) => ({ default: module.ProjectsPage })));
const ApplicationsPage = lazy(() => import("./projects/ApplicationsPage").then((module) => ({ default: module.ApplicationsPage })));
const ProjectDetailPage = lazy(() => import("./projects/ProjectDetailPage").then((module) => ({ default: module.ProjectDetailPage })));
const StoragePage = lazy(() => import("./storage/StoragePage").then((module) => ({ default: module.StoragePage })));

function AppLoading() {
  return <div className="app-loading" role="status" aria-live="polite">
    <div className="app-loading-mark"><span className="brand-symbol">SC<span>.</span></span><i aria-hidden="true" /></div>
    <div><strong>Preparing your workspace</strong><p>Connecting clients, delivery, and billing…</p></div>
  </div>;
}

const router = createBrowserRouter([
  {
    path: "/", element: <Shell />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: "clients", element: <ClientsPage /> },
      { path: "clients/:clientId", element: <ClientDetailPage /> },
      { path: "clients/:clientId/details", element: <ClientDetailsPage /> },
      { path: "clients/:clientId/apps/:applicationId", element: <TasksPage /> },
      { path: "work", element: <WorkspaceTasksPage /> },
      { path: "projects", element: <ProjectsPage /> },
      { path: "projects/:projectId", element: <ProjectDetailPage /> },
      { path: "applications", element: <ApplicationsPage /> },
      { path: "applications/:clientId/:applicationId", element: <TasksPage /> },
      { path: "members", element: <MembersPage /> },
      { path: "storage", element: <StoragePage /> },
    ],
  },
]);

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => onAuthStateChanged(fb.auth, async (u) => {
    setReady(false);
    setUser(u);
    try {
      if (u) {
        const token = await u.getIdTokenResult();
        if (token.claims.role === "client") {
          const clientId = token.claims.clientId as string | undefined;
          setAccessDenied(!clientId);
          setSession({ role: "client", clientId, uid: u.uid });
        } else {
          const member = await getMember(fb.db, u.uid);
          setAccessDenied(!member || member.status !== "active");
          setSession({ role: member?.role ?? "member", uid: u.uid });
        }
      } else {
        setAccessDenied(false);
        setSession(null);
      }
    } catch {
      // Fail closed while still giving the user a way to sign out and retry.
      setAccessDenied(Boolean(u));
      setSession(u ? { role: "member", uid: u.uid } : null);
    } finally {
      setReady(true);
    }
  }), []);

  if (!ready) return <AppLoading />;
  if (!user || !session) return <Suspense fallback={<AppLoading />}><LoginPage /></Suspense>;
  if (accessDenied) return <Suspense fallback={<AppLoading />}><AccessDenied /></Suspense>;
  if (session.role === "client" && session.clientId) {
    return <SessionProvider value={session}><Suspense fallback={<AppLoading />}><ClientPortal clientId={session.clientId} /></Suspense></SessionProvider>;
  }
  return <SessionProvider value={session}><Suspense fallback={<AppLoading />}><RouterProvider router={router} /></Suspense></SessionProvider>;
}
