import { Link, Outlet } from "react-router-dom";
import { signOut } from "firebase/auth";
import { listMemberNotifications } from "@solvingclub/core";
import { fb } from "../firebase";
import { db } from "../db";
import { NotificationBell } from "../notifications/NotificationBell";

export function Shell() {
  return (
    <div>
      <header style={{ display: "flex", gap: 12, padding: 12, borderBottom: "1px solid #ddd" }}>
        <strong>SolvingClub CMS</strong>
        <Link to="/clients">Clients</Link>
        <span style={{ flex: 1 }} />
        <NotificationBell fetchNotifications={() => {
          const uid = fb.auth.currentUser?.uid;
          return uid ? listMemberNotifications(db, uid) : Promise.resolve([]);
        }} />
        <button onClick={() => signOut(fb.auth)}>Sign out</button>
      </header>
      <main style={{ padding: 16 }}><Outlet /></main>
    </div>
  );
}
