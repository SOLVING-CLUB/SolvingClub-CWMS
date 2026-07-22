import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { subscribeMemberNotifications } from "@solvingclub/core";
import {
  Boxes, BriefcaseBusiness, Command, FolderKanban, LayoutDashboard, LogOut, Search, SquareCheckBig, Users,
} from "lucide-react";
import { fb } from "../firebase";
import { db } from "../db";
import { NotificationBell } from "../notifications/NotificationBell";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { BrandLogo } from "./BrandLogo";
import { GlobalSearchDialog } from "./GlobalSearchDialog";
import { useSession } from "../auth/SessionContext";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/work", label: "All work", icon: SquareCheckBig },
  { to: "/clients", label: "Clients", icon: BriefcaseBusiness },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/applications", label: "Applications", icon: Boxes },
];

function routeLabel(pathname: string) {
  if (pathname === "/") return "Overview";
  if (pathname.startsWith("/work")) return "All work";
  if (pathname.startsWith("/projects")) return "Projects";
  if (pathname === "/applications") return "Applications";
  if (pathname.startsWith("/applications/")) return "Application workspace";
  if (pathname.startsWith("/members")) return "Members";
  if (pathname.includes("/apps/")) return "Application tasks";
  if (pathname !== "/clients" && pathname.startsWith("/clients/")) return "Client workspace";
  return "Clients";
}

export function Shell() {
  const location = useLocation();
  const session = useSession();
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, []);
  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="workspace-switcher">
          <BrandLogo className="workspace-brand-logo" />
          <span className="workspace-edition">Delivery OS</span>
        </div>

        <button className="quick-search" type="button" onClick={() => setSearchOpen(true)}><Search /><span>Search</span><kbd><Command />K</kbd></button>

        <nav className="workspace-nav" aria-label="Workspace">
          <div className="nav-label">Workspace</div>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `workspace-link${isActive ? " active" : ""}`}>
              <Icon /><span>{label}</span>
            </NavLink>
          ))}
          {session.role === "owner" && <NavLink to="/members" className={({ isActive }) => `workspace-link${isActive ? " active" : ""}`}><Users /><span>Members</span></NavLink>}
        </nav>

        <div className="sidebar-account">
          <span className="account-avatar">{fb.auth.currentUser?.email?.slice(0, 1).toUpperCase()}</span>
          <span><strong>{fb.auth.currentUser?.email?.split("@")[0]}</strong><small>{fb.auth.currentUser?.email}</small></span>
          <Button aria-label="Sign out" variant="ghost" size="icon-sm" onPress={() => signOut(fb.auth)}><LogOut /></Button>
        </div>
      </aside>

      <section className="workspace-main">
        <header className="workspace-toolbar">
          <div className="toolbar-context"><span>SolvingClub</span><i>/</i><strong>{routeLabel(location.pathname)}</strong></div>
          <div className="toolbar-actions">
            <Button variant="ghost" size="sm" onPress={() => setSearchOpen(true)}><Search /> Search</Button>
            <ThemeToggle compact />
            <NotificationBell subscribeNotifications={(onData, onError) => {
              const uid = fb.auth.currentUser?.uid;
              if (!uid) { onData([]); return () => {}; }
              return subscribeMemberNotifications(db, uid, onData, onError);
            }} />
          </div>
        </header>
        <main className="workspace-content"><Outlet /></main>
      </section>
      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
