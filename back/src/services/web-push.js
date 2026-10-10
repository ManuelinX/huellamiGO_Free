import webPush from "web-push";
import { config } from "../config.js";
import { db } from "../db.js";

let configured = false;

function getVapidConfig() {
  return config.webPush;
}

function configureWebPush() {
  if (configured) {
    return true;
  }

  const { publicKey, privateKey, subject } = getVapidConfig();

  if (!publicKey || !privateKey) {
    return false;
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

function mapSubscriptionRow(row) {
  return {
    id: row.id,
    endpoint: row.endpoint,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
    disabledAt: row.disabled_at,
  };
}

function getExpirationTime(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function assertSubscription(subscription) {
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    const error = new Error("Suscripción push inválida");
    error.statusCode = 400;
    throw error;
  }
}

export function getWebPushConfig() {
  const { publicKey } = getVapidConfig();

  return {
    enabled: Boolean(publicKey && config.webPush.privateKey),
    publicKey: publicKey ?? null,
  };
}

export async function upsertWebPushSubscription({
  profileId,
  subscription,
  userAgent = null,
  client = db,
}) {
  assertSubscription(subscription);

  const result = await client.query(
    `
      INSERT INTO public.web_push_subscriptions (
        profile_id,
        endpoint,
        p256dh,
        auth,
        expiration_time,
        user_agent,
        last_seen_at,
        disabled_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, now(), null)
      ON CONFLICT (endpoint) DO UPDATE
      SET
        profile_id = EXCLUDED.profile_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        expiration_time = EXCLUDED.expiration_time,
        user_agent = EXCLUDED.user_agent,
        last_seen_at = now(),
        disabled_at = null
      RETURNING *
    `,
    [
      profileId,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth,
      getExpirationTime(subscription.expirationTime),
      userAgent,
    ],
  );

  return mapSubscriptionRow(result.rows[0]);
}

export async function listActiveWebPushSubscriptions({ profileId, client = db }) {
  const result = await client.query(
    `
      SELECT *
      FROM public.web_push_subscriptions
      WHERE profile_id = $1
        AND disabled_at IS NULL
      ORDER BY updated_at DESC
    `,
    [profileId],
  );

  return result.rows.map(mapSubscriptionRow);
}

export async function disableWebPushSubscription({
  profileId,
  endpoint = null,
  client = db,
}) {
  const params = [profileId];
  const endpointClause = endpoint ? "AND endpoint = $2" : "";

  if (endpoint) {
    params.push(endpoint);
  }

  const result = await client.query(
    `
      UPDATE public.web_push_subscriptions
      SET disabled_at = now()
      WHERE profile_id = $1
        ${endpointClause}
        AND disabled_at IS NULL
      RETURNING *
    `,
    params,
  );

  return result.rows.map(mapSubscriptionRow);
}

export async function sendWebPushToProfile({
  profileId,
  title,
  body = "",
  data = {},
  tag = null,
  client = db,
}) {
  if (!configureWebPush()) {
    return {
      sentCount: 0,
      failedCount: 0,
      skippedReason: "web_push_not_configured",
    };
  }

  const result = await client.query(
    `
      SELECT id, endpoint, p256dh, auth
      FROM public.web_push_subscriptions
      WHERE profile_id = $1
        AND disabled_at IS NULL
    `,
    [profileId],
  );

  if (result.rows.length === 0) {
    return {
      sentCount: 0,
      failedCount: 0,
      skippedReason: "no_active_subscription",
    };
  }

  let sentCount = 0;
  let failedCount = 0;

  for (const subscription of result.rows) {
    try {
      await webPush.sendNotification({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      }, JSON.stringify({
        title,
        body,
        tag,
        data,
      }));

      sentCount += 1;
    } catch (error) {
      failedCount += 1;

      if (error.statusCode === 404 || error.statusCode === 410) {
        await client.query(
          `
            UPDATE public.web_push_subscriptions
            SET disabled_at = now()
            WHERE id = $1
          `,
          [subscription.id],
        );
      }
    }
  }

  return {
    sentCount,
    failedCount,
    skippedReason: null,
  };
}
