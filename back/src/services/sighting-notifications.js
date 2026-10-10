import { db } from "../db.js";
import { getNotificationPreferences } from "./notification-preferences.js";
import {
  createLoggedMobilePushNotification,
  createLoggedNotification,
  createLoggedWebPushNotification,
  createSkippedNotificationLog,
} from "./notifications.js";
import {
  getNearbySightingNotification,
  getSightingNotificationDecision,
  notificationChannels,
  notificationTypes,
} from "./notification-rules.js";
import {
  countNormalSightingsInDigestWindow,
  enqueueSightingDigest,
} from "./sighting-digest-queue.js";

export async function handleSightingCreated({
  reportId,
  sighting,
  actorProfileId,
  client = db,
}) {
  const report = await getSightingReport({ reportId, client });

  if (!report || report.profile_id === actorProfileId) {
    return null;
  }

  const notification = getNearbySightingNotification({ report, sighting });
  const preferences = await getNotificationPreferences({
    profileId: report.profile_id,
    client,
  });

  if (!preferences.notifySightingUpdates) {
    return createSkippedNotificationLog({
      profileId: report.profile_id,
      reportId: report.id,
      sightingId: sighting.id,
      type: notificationTypes.nearbySighting,
      channel: notificationChannels.inApp,
      dedupeKey: notification.dedupeKey,
      reason: "sighting_updates_disabled",
      client,
    });
  }

  const decision = getSightingNotificationDecision(sighting);

  if (decision.mode === "immediate") {
    return sendImmediateOwnerSightingNotification({
      report,
      sighting,
      notification,
      client,
    });
  }

  const windowActivity = await countNormalSightingsInDigestWindow({
    reportId,
    createdAt: sighting.created_at ?? sighting.createdAt,
    client,
  });

  if (windowActivity.count <= windowActivity.immediateAllowance) {
    return sendImmediateOwnerSightingNotification({
      report,
      sighting,
      notification,
      client,
    });
  }

  return enqueueSightingDigest({
    reportId,
    sighting,
    reason: decision.reason,
    client,
  });
}

async function getSightingReport({ reportId, client = db }) {
  const result = await client.query(
    `
      SELECT id, profile_id, pet_name, zone
      FROM public.pet_reports
      WHERE id = $1
      LIMIT 1
    `,
    [reportId],
  );

  return result.rows[0] ?? null;
}

async function sendImmediateOwnerSightingNotification({
  report,
  reportId,
  sighting,
  notification,
  client = db,
}) {
  const loggedNotification = await createLoggedNotification({
    profileId: report.profile_id,
    reportId: reportId ?? report.id,
    sightingId: sighting.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    channel: notificationChannels.inApp,
    dedupeKey: notification.dedupeKey,
    client,
  });
  const loggedPushNotification = await createLoggedWebPushNotification({
    profileId: report.profile_id,
    reportId: reportId ?? report.id,
    sightingId: sighting.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    dedupeKey: notification.dedupeKey,
    client,
  });
  const loggedMobilePushNotification = await createLoggedMobilePushNotification({
    profileId: report.profile_id,
    reportId: reportId ?? report.id,
    sightingId: sighting.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    dedupeKey: notification.dedupeKey,
    client,
  });

  return {
    inApp: loggedNotification,
    webPush: loggedPushNotification,
    mobilePush: loggedMobilePushNotification,
  };
}
