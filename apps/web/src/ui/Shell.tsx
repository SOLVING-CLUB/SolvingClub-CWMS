import { NavLink, Outlet } from "react-router-dom";
import { signOut } from "firebase/auth";
import { listMemberNotifications } from "@solvingclub/core";
import { fb } from "../firebase";
import { db } from "../db";
import { NotificationBell } from "../notifications/NotificationBell";

export function Shell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand wordmark">SolvingClub</div>

        <div className="sidebar-label">Workspace</div>
        <nav className="sidebar-nav">
          <NavLink to="/clients" className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            Clients
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <NotificationBell fetchNotifications={() => {
            const uid = fb.auth.currentUser?.uid;
            return uid ? listMemberNotifications(db, uid) : Promise.resolve([]);
          }} />
          <div className="sidebar-identity mono">{fb.auth.currentUser?.email}</div>
          <button onClick={() => signOut(fb.auth)}>Sign out</button>
        </div>
      </aside>

      <div className="app-main">
        <main className="page"><Outlet /></main>
      </div>
    </div>
  );
}
