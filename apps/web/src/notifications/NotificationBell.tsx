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
      <button onClick={() => setOpen((o) => !o)} style={{ position: "relative" }}>
        Notifications
        {unread > 0 && (
          <span className="mono" style={{
            marginLeft: 6, background: "var(--accent)", color: "var(--accent-ink)",
            fontSize: 10, fontWeight: 600, padding: "1px 5px", borderRadius: 8,
          }}>
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="card" style={{
          position: "absolute", right: 0, top: "calc(100% + 6px)", width: 300, zIndex: 10, padding: 0,
          maxHeight: 360, overflowY: "auto",
        }}>
          {items.length === 0 ? (
            <p className="empty-state" style={{ padding: 14 }}>No notifications.</p>
          ) : (
            items.map((n, i) => (
              <div key={n.id} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
                borderBottom: i < items.length - 1 ? "1px solid var(--line)" : "none",
                opacity: n.read ? 0.55 : 1,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: n.read ? "transparent" : "var(--accent)", flexShrink: 0,
                }} />
                <span style={{ fontSize: 13, flex: 1 }}>{n.title}</span>
                {!n.read && (
                  <button onClick={async () => { await markNotificationRead(db, n.id); await refresh(); }}
                    style={{ fontSize: 11, padding: "3px 7px", flexShrink: 0 }}>
                    Mark read
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
