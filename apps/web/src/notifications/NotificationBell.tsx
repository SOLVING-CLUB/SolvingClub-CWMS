import { useEffect, useState, type Key } from "react";
import { markNotificationRead, markNotificationsRead, type Notification } from "@solvingclub/core";
import type { Unsubscribe } from "firebase/firestore";
import { db } from "../db";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";

function timeAgo(timestamp: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function NotificationBell(
  { subscribeNotifications }: {
    subscribeNotifications: (onData: (notifications: Notification[]) => void, onError: () => void) => Unsubscribe;
  },
) {
  const [items, setItems] = useState<Notification[]>([]);
  const [listenerError, setListenerError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  useEffect(() => {
    return subscribeNotifications((notifications) => { setItems(notifications); setListenerError(false); }, () => setListenerError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadItems = items.filter((item) => !item.read);

  async function act(key: Key) {
    if (key === "__mark_all") {
      try { await markNotificationsRead(db, unreadItems.map((item) => item.id)); setActionError(null); }
      catch { setActionError("Notifications could not be marked as read. Please try again."); }
      return;
    }
    const item = items.find((notification) => notification.id === String(key));
    if (!item) return;
    if (!item.read) {
      try { await markNotificationRead(db, item.id); setActionError(null); }
      catch { setActionError("This notification could not be marked as read."); }
    }
    if (item.link?.startsWith("/")) window.location.assign(item.link);
  }

  return (
    <DropdownMenuTrigger>
      <Button aria-label={unreadItems.length ? `Notifications, ${unreadItems.length} unread` : "Notifications"} variant="ghost" size="icon-sm" className="notification-trigger">
        <Bell />
        {unreadItems.length > 0 && <span className="notification-count">{unreadItems.length > 9 ? "9+" : unreadItems.length}</span>}
      </Button>
      <DropdownMenu placement="bottom end" className="notification-menu" onAction={act}>
        <DropdownMenuLabel className="notification-menu-header">
          <span><strong>Notifications</strong><small>{unreadItems.length} unread</small></span>
        </DropdownMenuLabel>
        {unreadItems.length > 0 && <><DropdownMenuItem id="__mark_all" className="notification-mark-all"><CheckCheck /> Mark all as read</DropdownMenuItem><DropdownMenuSeparator /></>}
        {listenerError && <><DropdownMenuItem id="__listener_error" isDisabled className="notification-listener-error">Live updates paused. Reopen the app to retry.</DropdownMenuItem><DropdownMenuSeparator /></>}
        {actionError && <><DropdownMenuItem id="__action_error" isDisabled className="notification-listener-error">{actionError}</DropdownMenuItem><DropdownMenuSeparator /></>}
        {items.length === 0 ? <DropdownMenuItem id="__empty" isDisabled className="notification-empty">You’re all caught up.</DropdownMenuItem> : items.slice(0, 12).map((item) => (
          <DropdownMenuItem key={item.id} id={item.id} textValue={item.title} className={`notification-menu-item${item.read ? " read" : ""}`}>
            <span className="notification-dot" />
            <span className="notification-copy"><strong>{item.title}</strong>{item.body && <small>{item.body}</small>}<time>{timeAgo(item.createdAt)}</time></span>
            {item.link && <ExternalLink className="notification-link-icon" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenu>
    </DropdownMenuTrigger>
  );
}
