import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { RouterProvider, createBrowserRouter, Navigate } from "react-router-dom";
import { fb } from "./firebase";
import { LoginPage } from "./auth/LoginPage";
import { Shell } from "./ui/Shell";
import { ClientsPage } from "./clients/ClientsPage";
import { ClientDetailPage } from "./clients/ClientDetailPage";
import { TasksPage } from "./tasks/TasksPage";
import { ClientPortal } from "./portal/ClientPortal";

const router = createBrowserRouter([
  {
    path: "/", element: <Shell />,
    children: [
      { index: true, element: <Navigate to="/clients" replace /> },
      { path: "clients", element: <ClientsPage /> },
      { path: "clients/:clientId", element: <ClientDetailPage /> },
      { path: "clients/:clientId/apps/:applicationId", element: <TasksPage /> },
    ],
  },
]);

type Session = { role: string; clientId?: string };

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => onAuthStateChanged(fb.auth, async (u) => {
    setUser(u);
    if (u) {
      const token = await u.getIdTokenResult();
      setSession({
        role: (token.claims.role as string) ?? "member",
        clientId: token.claims.clientId as string | undefined,
      });
    } else {
      setSession(null);
    }
    setReady(true);
  }), []);

  if (!ready) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg)", color: "var(--ink-faint)", fontFamily: "var(--font-mono)", fontSize: 12,
      }}>
        loading…
      </div>
    );
  }
  if (!user || !session) return <LoginPage />;
  if (session.role === "client" && session.clientId) {
    return <ClientPortal clientId={session.clientId} />;
  }
  return <RouterProvider router={router} />;
}
