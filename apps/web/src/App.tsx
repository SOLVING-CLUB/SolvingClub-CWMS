import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { RouterProvider, createBrowserRouter, Navigate } from "react-router-dom";
import { fb } from "./firebase";
import { LoginPage } from "./auth/LoginPage";
import { Shell } from "./ui/Shell";
import { ClientsPage } from "./clients/ClientsPage";
import { ClientDetailPage } from "./clients/ClientDetailPage";
import { TasksPage } from "./tasks/TasksPage";

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

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => onAuthStateChanged(fb.auth, (u) => { setUser(u); setReady(true); }), []);

  if (!ready) return <p>Loading…</p>;
  if (!user) return <LoginPage />;
  return <RouterProvider router={router} />;
}
