import { Link, Outlet } from "react-router-dom";
import { signOut } from "firebase/auth";
import { fb } from "../firebase";

export function Shell() {
  return (
    <div>
      <header style={{ display: "flex", gap: 12, padding: 12, borderBottom: "1px solid #ddd" }}>
        <strong>SolvingClub CMS</strong>
        <Link to="/clients">Clients</Link>
        <span style={{ flex: 1 }} />
        <button onClick={() => signOut(fb.auth)}>Sign out</button>
      </header>
      <main style={{ padding: 16 }}><Outlet /></main>
    </div>
  );
}
