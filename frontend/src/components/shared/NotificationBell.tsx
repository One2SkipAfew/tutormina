import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '../../contexts/AuthContext';
import type { Notification } from '../../types/lms';
import '../../styles/messaging.css';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeToNotifications,
} from '../../lib/messaging';

const Bell = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const refresh = useCallback(async () => {
    try {
      setUnreadCount(await getUnreadNotificationCount());
    } catch {
      // Non-fatal - bell just shows no badge.
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!user) return;

    channelRef.current = subscribeToNotifications(user.id, (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [user, refresh]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleToggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        setNotifications(await getNotifications());
      } catch {
        // Non-fatal - dropdown shows empty state.
      }
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markNotificationRead(notification.id);
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setOpen(false);
    if (notification.link) navigate(notification.link);
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  return (
    <div className="notification-bell" ref={dropdownRef}>
      <button className="topbar-btn" aria-label="Notifications" onClick={handleToggle}>
        <Bell />
        {unreadCount > 0 && <span className="topbar-notification-dot" />}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button className="notification-mark-all-read" onClick={handleMarkAllRead}>Mark all read</button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="notification-dropdown-empty">No notifications yet</div>
          ) : (
            <ul className="notification-dropdown-list">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    className={`notification-item ${n.is_read ? '' : 'unread'}`}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <div className="notification-item-title">{n.title}</div>
                    {n.body && <div className="notification-item-body">{n.body}</div>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
