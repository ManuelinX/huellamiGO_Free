import { db } from "../db.js";
import { sendMobilePushToProfile } from "./mobile-push.js";
import { sendWebPushToProfile } from "./web-push.js";

function mapNotificationRow(row) {
  return {
    id: row.id,
    profileId: row.profile_id,
    reportId: row.report_id,
    sightingId: row.sighting_id,
    createdAt: row.created_at,
    readAt: row.read_at,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data ?? {},
  };
}

export async function createNotification({
  profileId,
  reportId = null,
  sightingId = null,
  type,
  title,
  body = null,
  data = {},
  client = db,
}) {
  const result = await client.query(
    `
      INSERT INTO public.notifications (
        profile_id,
        report_id,
        sighting_id,
        type,
        title,
        body,
        data
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [profileId, reportId, sightingId, type, title, body, data],
  );

  return result.rows[0];
}

export async function createLoggedNotification({
  profileId,
  reportId = null,
  sightingId = null,
  type,
  title,
  body = null,
  data = {},
  channel = "in_app",
  dedupeKey,
  client = db,
}) {
  const logResult = await client.query(
    `
      INSERT INTO public.notification_logs (
        profile_id,
        report_id,
        sighting_id,
        notification_type,
        channel,
        dedupe_key,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      ON CONFLICT (profile_id, channel, dedupe_key) DO NOTHING
      RETURNING id
    `,
    [profileId, reportId, sightingId, type, channel, dedupeKey],
  );
  const log = logResult.rows[0];

  if (!log) {
    return {
      created: false,
      reason: "duplicate",
      notification: null,
    };
  }

  try {
    const notification = await createNotification({
      profileId,
      reportId,
      sightingId,
      type,
      title,
      body,
      data,
      client,
    });

    await client.query(
      `
        UPDATE public.notification_logs
        SET
          notification_id = $1,
          status = 'sent',
          sent_at = now()
        WHERE id = $2
      `,
      [notification.id, log.id],
    );

    return {
      created: true,
      reason: null,
      notification,
    };
  } catch (error) {
    await client.query(
      `
        UPDATE public.notification_logs
        SET
          status = 'failed',
          failure_reason = $1
        WHERE id = $2
      `,
      [error.message, log.id],
    );

    return {
      created: true,
      reason: error.message,
      result: null,
    };
  }
}

export async function createSkippedNotificationLog({
  profileId,
  reportId = null,
  sightingId = null,
  type,
  channel = "in_app",
  dedupeKey,
  reason,
  client = db,
}) {
  const result = await client.query(
    `
      INSERT INTO public.notification_logs (
        profile_id,
        report_id,
        sighting_id,
        notification_type,
        channel,
        dedupe_key,
        status,
        failure_reason
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'skipped', $7)
      ON CONFLICT (profile_id, channel, dedupe_key) DO NOTHING
      RETURNING id
    `,
    [profileId, reportId, sightingId, type, channel, dedupeKey, reason],
  );

  return {
    created: Boolean(result.rows[0]),
    reason,
  };
}

export async function createLoggedWebPushNotification({
  profileId,
  reportId = null,
  sightingId = null,
  type,
  title,
  body = null,
  data = {},
  dedupeKey,
  client = db,
}) {
  const logResult = await client.query(
    `
      INSERT INTO public.notification_logs (
        profile_id,
        report_id,
        sighting_id,
        notification_type,
        channel,
        dedupe_key,
        status
      )
      VALUES ($1, $2, $3, $4, 'web_push', $5, 'pending')
      ON CONFLICT (profile_id, channel, dedupe_key) DO NOTHING
      RETURNING id
    `,
    [profileId, reportId, sightingId, type, dedupeKey],
  );
  const log = logResult.rows[0];

  if (!log) {
    return {
      created: false,
      reason: "duplicate",
      result: null,
    };
  }

  try {
    const result = await sendWebPushToProfile({
      profileId,
      title,
      body,
      data,
      tag: dedupeKey,
      client,
    });
    const status = result.sentCount > 0 ? "sent" : "skipped";
    const failureReason = result.skippedReason
      ?? (result.failedCount > 0 ? `failed:${result.failedCount}` : null);

    await client.query(
      `
        UPDATE public.notification_logs
        SET
          status = $1,
          failure_reason = $2,
          sent_at = CASE WHEN $1 = 'sent' THEN now() ELSE sent_at END
        WHERE id = $3
      `,
      [status, failureReason, log.id],
    );

    return {
      created: true,
      reason: failureReason,
      result,
    };
  } catch (error) {
    await client.query(
      `
        UPDATE public.notification_logs
        SET
          status = 'failed',
          failure_reason = $1
        WHERE id = $2
      `,
      [error.message, log.id],
    );

    throw error;
  }
}

export async function createLoggedMobilePushNotification({
  profileId,
  reportId = null,
  sightingId = null,
  type,
  title,
  body = null,
  data = {},
  dedupeKey,
  client = db,
}) {
  const logResult = await client.query(
    `
      INSERT INTO public.notification_logs (
        profile_id,
        report_id,
        sighting_id,
        notification_type,
        channel,
        dedupe_key,
        status
      )
      VALUES ($1, $2, $3, $4, 'mobile_push', $5, 'pending')
      ON CONFLICT (profile_id, channel, dedupe_key) DO NOTHING
      RETURNING id
    `,
    [profileId, reportId, sightingId, type, dedupeKey],
  );
  const log = logResult.rows[0];

  if (!log) {
    return {
      created: false,
      reason: "duplicate",
      result: null,
    };
  }

  try {
    const result = await sendMobilePushToProfile({
      profileId,
      title,
      body,
      data: { ...data, type },
      tag: dedupeKey,
      client,
    });
    const status = result.sentCount > 0 ? "sent" : "skipped";
    const failureReason = result.skippedReason
      ?? (result.failedCount > 0 ? `failed:${result.failedCount}` : null);

    await client.query(
      `
        UPDATE public.notification_logs
        SET
          status = $1,
          failure_reason = $2,
          sent_at = CASE WHEN $1 = 'sent' THEN now() ELSE sent_at END
        WHERE id = $3
      `,
      [status, failureReason, log.id],
    );

    return {
      created: true,
      reason: failureReason,
      result,
    };
  } catch (error) {
    await client.query(
      `
        UPDATE public.notification_logs
        SET
          status = 'failed',
          failure_reason = $1
        WHERE id = $2
      `,
      [error.message, log.id],
    );

    throw error;
  }
}

export async function listNotifications({ profileId, limit = 30, client = db }) {
  const result = await client.query(
    `
      SELECT *
      FROM public.notifications
      WHERE profile_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [profileId, limit],
  );

  return result.rows.map(mapNotificationRow);
}

export async function getUnreadNotificationsCount({ profileId, client = db }) {
  const result = await client.query(
    `
      SELECT count(*)::integer AS unread_count
      FROM public.notifications
      WHERE profile_id = $1
        AND read_at IS NULL
    `,
    [profileId],
  );

  return Number(result.rows[0]?.unread_count ?? 0);
}

export async function markNotificationAsRead({ profileId, notificationId, client = db }) {
  const result = await client.query(
    `
      UPDATE public.notifications
      SET read_at = COALESCE(read_at, now())
      WHERE id = $1
        AND profile_id = $2
      RETURNING *
    `,
    [notificationId, profileId],
  );

  return result.rows[0] ? mapNotificationRow(result.rows[0]) : null;
}

export async function markAllNotificationsAsRead({ profileId, client = db }) {
  const result = await client.query(
    `
      UPDATE public.notifications
      SET read_at = COALESCE(read_at, now())
      WHERE profile_id = $1
        AND read_at IS NULL
      RETURNING id
    `,
    [profileId],
  );

  return result.rowCount;
}
