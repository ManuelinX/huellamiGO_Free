import { Router } from "express";
import {
  getUnreadNotificationsCount,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../services/notifications.js";
import {
  getNotificationPreferences,
  upsertNotificationPreferences,
} from "../services/notification-preferences.js";
import {
  disableWebPushSubscription,
  getWebPushConfig,
  listActiveWebPushSubscriptions,
  upsertWebPushSubscription,
} from "../services/web-push.js";
import {
  disableMobilePushToken,
  getMobilePushConfig,
  upsertMobilePushToken,
} from "../services/mobile-push.js";
import { requireAuth } from "../utils/auth.js";
import { asyncHandler, clamp, createBadRequest, toNumber } from "../utils/http.js";
import { requireBetaAccessForUser, requireSignedBetaAccess } from "../middleware/beta-shield.js";

export const notificationsRouter = Router();

notificationsRouter.get("/", asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  requireBetaAccessForUser(req, user);
  const limit = Math.trunc(clamp(toNumber(req.query.limit, 30), 1, 100));
  const notifications = await listNotifications({
    profileId: user.id,
    limit,
  });

  res.json({
    ok: true,
    notifications,
  });
}));

notificationsRouter.get("/unread-count", asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  requireBetaAccessForUser(req, user);
  const unreadCount = await getUnreadNotificationsCount({
    profileId: user.id,
  });

  res.json({
    ok: true,
    unreadCount,
  });
}));

notificationsRouter.get("/preferences", asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  requireBetaAccessForUser(req, user);
  const preferences = await getNotificationPreferences({
    profileId: user.id,
  });

  res.json({
    ok: true,
    preferences,
  });
}));

notificationsRouter.patch("/preferences", asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  requireBetaAccessForUser(req, user);
  const currentPreferences = await getNotificationPreferences({
    profileId: user.id,
  });
  const alertLat = toNumber(req.body.alertLat, currentPreferences.alertLat);
  const alertLng = toNumber(req.body.alertLng, currentPreferences.alertLng);
  const locationSource = req.body.locationSource === undefined
    ? currentPreferences.locationSource
    : req.body.locationSource === "auto" ? "auto" : "manual";

  if (alertLat !== null && (alertLat < -90 || alertLat > 90)) {
    throw createBadRequest("Latitud de alertas fuera de rango");
  }

  if (alertLng !== null && (alertLng < -180 || alertLng > 180)) {
    throw createBadRequest("Longitud de alertas fuera de rango");
  }

  const preferences = await upsertNotificationPreferences({
    profileId: user.id,
    notifySightingUpdates: req.body.notifySightingUpdates === undefined
      ? currentPreferences.notifySightingUpdates
      : Boolean(req.body.notifySightingUpdates),
    notifyNearbyReports: req.body.notifyNearbyReports === undefined
      ? currentPreferences.notifyNearbyReports
      : Boolean(req.body.notifyNearbyReports),
    radiusKm: currentPreferences.radiusKm,
    alertLat,
    alertLng,
    alertPlaceLabel: req.body.alertPlaceLabel === undefined
      ? currentPreferences.alertPlaceLabel
      : req.body.alertPlaceLabel?.toString().trim() || null,
    locationSource,
  });

  res.json({
    ok: true,
    preferences,
  });
}));

notificationsRouter.get("/push/config", asyncHandler(async (req, res) => {
  requireSignedBetaAccess(req);

  res.json({
    ok: true,
    webPush: getWebPushConfig(),
    mobilePush: getMobilePushConfig(),
  });
}));

notificationsRouter.get("/push/subscriptions", asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  requireBetaAccessForUser(req, user);
  const subscriptions = await listActiveWebPushSubscriptions({
    profileId: user.id,
  });

  res.json({
    ok: true,
    subscriptions,
  });
}));

notificationsRouter.post("/push/subscriptions", asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  requireBetaAccessForUser(req, user);
  const { enabled } = getWebPushConfig();

  if (!enabled) {
    throw createBadRequest("Web Push no está configurado en el servidor");
  }

  const subscription = await upsertWebPushSubscription({
    profileId: user.id,
    subscription: req.body.subscription,
    userAgent: String(req.headers["user-agent"] ?? "").slice(0, 255) || null,
  });

  res.status(201).json({
    ok: true,
    subscription,
  });
}));

notificationsRouter.post("/push/mobile-tokens", asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  requireBetaAccessForUser(req, user);
  const token = req.body.token?.toString().trim();

  if (!token) {
    throw createBadRequest("Token FCM requerido");
  }

  const mobileToken = await upsertMobilePushToken({
    profileId: user.id,
    token,
    platform: req.body.platform?.toString(),
    deviceId: req.body.deviceId?.toString() || null,
    appVersion: req.body.appVersion?.toString() || null,
  });

  res.status(201).json({
    ok: true,
    token: {
      id: mobileToken.id,
      platform: mobileToken.platform,
      disabledAt: mobileToken.disabled_at,
      updatedAt: mobileToken.updated_at,
    },
  });
}));

notificationsRouter.delete("/push/mobile-tokens", asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  requireBetaAccessForUser(req, user);
  const token = req.body.token?.toString().trim();

  if (!token) {
    throw createBadRequest("Token FCM requerido");
  }

  const mobileToken = await disableMobilePushToken({
    profileId: user.id,
    token,
  });

  res.json({
    ok: true,
    disabled: Boolean(mobileToken),
  });
}));

notificationsRouter.delete("/push/subscriptions", asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  requireBetaAccessForUser(req, user);
  const disabledSubscriptions = await disableWebPushSubscription({
    profileId: user.id,
    endpoint: req.body.endpoint?.toString() || null,
  });

  res.json({
    ok: true,
    disabledCount: disabledSubscriptions.length,
  });
}));

notificationsRouter.patch("/read-all", asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  requireBetaAccessForUser(req, user);
  const updatedCount = await markAllNotificationsAsRead({
    profileId: user.id,
  });

  res.json({
    ok: true,
    updatedCount,
  });
}));

notificationsRouter.patch("/:id/read", asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  requireBetaAccessForUser(req, user);
  const notification = await markNotificationAsRead({
    profileId: user.id,
    notificationId: req.params.id,
  });

  if (!notification) {
    res.status(404).json({
      ok: false,
      error: "Notificación no encontrada",
    });
    return;
  }

  res.json({
    ok: true,
    notification,
  });
}));
