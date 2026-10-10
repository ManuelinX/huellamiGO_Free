import { db } from "../db.js";
import {
  createLoggedMobilePushNotification,
  createLoggedNotification,
  createLoggedWebPushNotification,
} from "./notifications.js";
import {
  calculateReportNotificationPriority,
  getNearbyReportNotification,
  notificationChannels,
} from "./notification-rules.js";
import { getPostgisSqlNames } from "./postgis.js";

export async function notifyNearbyUsersAboutReport({ report, actorProfileId, client = db }) {
  const priority = calculateReportNotificationPriority(report);

  if (!priority.shouldPush) {
    return {
      matchedUsers: 0,
      createdNotifications: 0,
      createdPushNotifications: 0,
      priority,
      skippedReason: "report_priority_no_push",
    };
  }

  const gis = getPostgisSqlNames();
  const result = await client.query(
    `
      SELECT
        np.profile_id,
        np.radius_km,
        $4::numeric AS effective_radius_km,
        np.alert_lat,
        np.alert_lng,
        ${gis.stDistance}(
          ${gis.stSetSrid}(${gis.stPoint}(np.alert_lng, np.alert_lat), 4326)::${gis.geography},
          ${gis.stSetSrid}(${gis.stPoint}($3, $2), 4326)::${gis.geography}
        ) AS distance_meters
      FROM public.notification_preferences np
      JOIN public.app_users u ON u.id = np.profile_id
      WHERE np.notify_nearby_reports = true
        AND np.alert_lat IS NOT NULL
        AND np.alert_lng IS NOT NULL
        AND np.profile_id <> $1
        AND u.status = 'active'
        AND ${gis.stDWithin}(
          ${gis.stSetSrid}(${gis.stPoint}(np.alert_lng, np.alert_lat), 4326)::${gis.geography},
          ${gis.stSetSrid}(${gis.stPoint}($3, $2), 4326)::${gis.geography},
          ($4 * 1000)::double precision
        )
      ORDER BY distance_meters ASC
      LIMIT 500
    `,
    [actorProfileId, report.last_seen_lat, report.last_seen_lng, priority.radiusKm],
  );

  const notifications = [];
  const pushNotifications = [];

  for (const recipient of result.rows) {
    const notification = getNearbyReportNotification({
      report,
      recipient: {
        ...recipient,
        priority,
      },
    });
    const loggedNotification = await createLoggedNotification({
      profileId: recipient.profile_id,
      reportId: report.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      channel: notificationChannels.inApp,
      dedupeKey: notification.dedupeKey,
      client,
    });
    const loggedPushNotification = await createLoggedWebPushNotification({
      profileId: recipient.profile_id,
      reportId: report.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      dedupeKey: notification.dedupeKey,
      client,
    });
    const loggedMobilePushNotification = await createLoggedMobilePushNotification({
      profileId: recipient.profile_id,
      reportId: report.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      dedupeKey: notification.dedupeKey,
      client,
    });

    notifications.push(loggedNotification);
    pushNotifications.push(loggedPushNotification);
    pushNotifications.push(loggedMobilePushNotification);
  }

  return {
    matchedUsers: result.rowCount,
    createdNotifications: notifications.filter((item) => item.created).length,
    createdPushNotifications: pushNotifications.filter((item) => item.created).length,
    priority,
  };
}
