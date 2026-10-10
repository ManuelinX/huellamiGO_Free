"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, CheckCheck, Clock3, PawPrint, RefreshCw, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getNotifications,
  getUnreadNotificationsCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/lib/notifications";
import { getUserErrorMessage } from "@/lib/user-messages";

function formatNotificationDate(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getNotificationHref(notification) {
  const reportId = notification.reportId ?? notification.data?.reportId;

  if (!reportId) {
    return null;
  }

  return notification.type === "nearby_sighting"
    ? `/mascotas/${reportId}#avistamiento`
    : `/mascotas/${reportId}`;
}

function getNotificationMeta(notification) {
  const meta = [];
  const zone = notification.data?.zone;
  const statusLabel = notification.data?.statusLabel
    ?? (notification.data?.status === "pending" ? "pendiente de revision" : null);

  if (zone) {
    meta.push(zone);
  }

  if (statusLabel) {
    meta.push(statusLabel);
  }

  return meta;
}

export function NotificationsButton() {
  const { user, isAuthLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadUnreadCount = () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    startTransition(async () => {
      try {
        setUnreadCount(await getUnreadNotificationsCount());
      } catch (error) {
        setUnreadCount(0);
      }
    });
  };

  const loadNotifications = () => {
    if (!user) {
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const nextNotifications = await getNotifications();
        setNotifications(nextNotifications);
        setUnreadCount(nextNotifications.filter((notification) => !notification.readAt).length);
      } catch (error) {
        setNotifications([]);
        setMessage(getUserErrorMessage(error, "No pudimos cargar tus notificaciones."));
      }
    });
  };

  useEffect(() => {
    loadUnreadCount();
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleRead = (notification) => {
    if (notification.readAt) {
      return;
    }

    startTransition(async () => {
      try {
        const updatedNotification = await markNotificationAsRead(notification.id);
        setNotifications((currentNotifications) => currentNotifications.map((item) => (
          item.id === updatedNotification.id ? updatedNotification : item
        )));
        setUnreadCount((currentCount) => Math.max(currentCount - 1, 0));
      } catch (error) {
        setMessage(getUserErrorMessage(error, "No pudimos actualizar esa notificacion."));
      }
    });
  };

  const handleReadAll = () => {
    startTransition(async () => {
      setMessage("");

      try {
        await markAllNotificationsAsRead();
        setNotifications((currentNotifications) => currentNotifications.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? new Date().toISOString(),
        })));
        setUnreadCount(0);
      } catch (error) {
        setMessage(getUserErrorMessage(error, "No pudimos marcar tus notificaciones como leidas."));
      }
    });
  };

  if (!user) {
    return null;
  }

  return (
    <div className="notificationsShell">
      <button
        className="ghostIcon notificationBell"
        disabled={isAuthLoading}
        onClick={handleOpen}
        type="button"
        aria-label="Ver notificaciones"
      >
        <Bell size={20} />
        {unreadCount > 0 ? (
          <span className="notificationBadge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        ) : null}
      </button>

      {isOpen ? createPortal((
        <div className="notificationsOverlay" role="presentation" onClick={() => setIsOpen(false)}>
          <section
            className="notificationsDrawer"
            aria-labelledby="notifications-title"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="authModalHeader">
              <div>
                <p className="eyebrow">Actividad</p>
                <h2 id="notifications-title">Notificaciones</h2>
              </div>
              <button className="ghostIcon" onClick={() => setIsOpen(false)} type="button" aria-label="Cerrar">
                <X size={19} />
              </button>
            </div>

            <div className="notificationsActions">
              <button className="ghostTextButton" disabled={isPending} onClick={loadNotifications} type="button">
                <RefreshCw size={16} />
                Actualizar
              </button>
              <button className="ghostTextButton" disabled={isPending || unreadCount === 0} onClick={handleReadAll} type="button">
                <CheckCheck size={16} />
                Leer todas
              </button>
            </div>

            {message ? <p className="formMessage">{message}</p> : null}

            {isPending && notifications.length === 0 ? (
              <div className="notificationsEmpty">
                <Clock3 size={20} />
                <p>Cargando notificaciones...</p>
              </div>
            ) : notifications.length > 0 ? (
              <div className="notificationsList">
                {notifications.map((notification) => {
                  const href = getNotificationHref(notification);
                  const meta = getNotificationMeta(notification);
                  const content = (
                    <>
                      <span className="notificationIcon">
                        <PawPrint size={18} />
                      </span>
                      <span className="notificationCopy">
                        <strong>{notification.title}</strong>
                        {notification.body ? <span>{notification.body}</span> : null}
                        {meta.length > 0 ? (
                          <span className="notificationMeta">{meta.join(" - ")}</span>
                        ) : null}
                        <small>{formatNotificationDate(notification.createdAt)}</small>
                      </span>
                    </>
                  );

                  return href ? (
                    <Link
                      className={`notificationItem ${notification.readAt ? "" : "isUnread"}`}
                      href={href}
                      key={notification.id}
                      onClick={() => handleRead(notification)}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      className={`notificationItem ${notification.readAt ? "" : "isUnread"}`}
                      key={notification.id}
                      onClick={() => handleRead(notification)}
                      type="button"
                    >
                      {content}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="notificationsEmpty">
                <Bell size={22} />
                <p>Cuando haya actividad importante, aparecera aqui.</p>
              </div>
            )}
          </section>
        </div>
      ), document.body) : null}
    </div>
  );
}
