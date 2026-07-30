import { NavLink } from "react-router-dom";
import { Boxes, FolderKanban } from "lucide-react";

type DeliveryTabsProps = {
  projects: number;
  applications: number;
};

/** A persistent handoff between the two separate delivery workspaces. */
export function DeliveryTabs({ projects, applications }: DeliveryTabsProps) {
  return <nav className="delivery-tabs" aria-label="Delivery workspaces">
    <NavLink to="/projects" className={({ isActive }) => isActive ? "active" : ""}>
      <FolderKanban aria-hidden="true" /> <span>Projects</span><b>{projects}</b>
    </NavLink>
    <NavLink to="/applications" className={({ isActive }) => isActive ? "active" : ""}>
      <Boxes aria-hidden="true" /> <span>Applications</span><b>{applications}</b>
    </NavLink>
  </nav>;
}
