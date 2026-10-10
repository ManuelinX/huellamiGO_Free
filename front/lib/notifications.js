import { apiFetch } from "@/lib/api";

export async function getNotifications({ limit = 30 } = {}) {
  const data = await apiFetch(`/api/notifications?limit=${limit}`, {
    auth: true,
  });

  return data.notifications;
}

export async function getUnreadNotificationsCount() {
  const data = await apiFetch("/api/notifications/unread-count", {
    auth: true,
  });

  return data.unreadCount;
}

export async function markNotificationAsRead(id) {
  const data = await apiFetch(`/api/notifications/${id}/read`, {
    method: "PATCH",
    auth: true,
  });

  return data.notification;
}

export async function markAllNotificationsAsRead() {
  const data = await apiFetch("/api/notifications/read-all", {
    method: "PATCH",
    auth: true,
  });

  return data.updatedCount;
}

export async function getNotificationPreferences() {
  const data = await apiFetch("/api/notifications/preferences", {
    auth: true,
  });

  return data.preferences;
}

export async function updateNotificationPreferences(preferences) {
  const data = await apiFetch("/api/notifications/preferences", {
    method: "PATCH",
    auth: true,
    body: preferences,
  });

  return data.preferences;
}

export async function getWebPushConfig() {
  const data = await apiFetch("/api/notifications/push/config");
  return data.webPush;
}

export async function getWebPushSubscriptions() {
  const data = await apiFetch("/api/notifications/push/subscriptions", {
    auth: true,
  });

  return data.subscriptions;
}

export async function saveWebPushSubscription(subscription) {
  const data = await apiFetch("/api/notifications/push/subscriptions", {
    method: "POST",
    auth: true,
    body: {
      subscription,
    },
  });

  return data.subscription;
}

export async function deleteWebPushSubscription(endpoint = null) {
  const data = await apiFetch("/api/notifications/push/subscriptions", {
    method: "DELETE",
    auth: true,
    body: {
      endpoint,
    },
  });

  return data.disabledCount;
}
