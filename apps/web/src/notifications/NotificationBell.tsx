import { useEffect, useState } from "react";
import { markNotificationRead, type Notification } from "@solvingclub/core";
import { db } from "../db";

export function NotificationBell(
  { fetchNotifications }: { fetchNotifications: () => Promise<Notification[]> },
) {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  async function refresh() { setItems(await fetchNotifications()); }
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unread = items.filter((n) => !n.read).length;

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)}>
        Notifications{unread > 0 ? ` (${unread})` : ""}
      </button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "100%", background: "white", color: "black",
          border: "1px solid #ccc", padding: 8, width: 280, zIndex: 10,
        }}>
          {items.length === 0 && <p>No notifications.</p>}
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {items.map((n) => (
              <li key={n.id} style={{ padding: "4px 0", borderBottom: "1px solid #eee", opacity: n.read ? 0.6 : 1 }}>
                <div>{n.title}</div>
                {!n.read && (
                  <button onClick={async () => { await markNotificationRead(db, n.id); await refresh(); }}>
                    mark read
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
