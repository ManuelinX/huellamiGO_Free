import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { db } from "../db.js";

const invalidTokenErrorCodes = new Set([
  "messaging/invalid-argument",
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

function parseServiceAccountJson(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getServiceAccountFromEnv() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const decoded = Buffer
      .from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64")
      .toString("utf8");
    return parseServiceAccountJson(decoded);
  }

  return parseServiceAccountJson(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
}

function getFirebaseCredential() {
  const serviceAccount = getServiceAccountFromEnv();
  if (serviceAccount) {
    return cert(serviceAccount);
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return applicationDefault();
  }

  return null;
}

function getFirebaseApp() {
  const existingApp = getApps()[0];
  if (existingApp) {
    return existingApp;
  }

  const credential = getFirebaseCredential();
  if (!credential) {
    return null;
  }

  const options = { credential };
  if (process.env.FIREBASE_PROJECT_ID) {
    options.projectId = process.env.FIREBASE_PROJECT_ID;
  }

  return initializeApp(options);
}

function normalizeToken(token) {
  return token?.toString().trim() || "";
}

function normalizePlatform(platform) {
  return platform === "ios" ? "ios" : "android";
}

function stringifyDataValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function getMessageData(data, tag) {
  const entries = Object.entries(data ?? {}).map(([key, value]) => [
    key,
    stringifyDataValue(value),
  ]);

  if (tag) {
    entries.push(["dedupeKey", tag]);
  }

  return Object.fromEntries(entries);
}

export function getMobilePushConfig() {
  return {
    enabled: Boolean(getFirebaseCredential()),
    projectId: process.env.FIREBASE_PROJECT_ID || null,
  };
}

export async function upsertMobilePushToken({
  profileId,
  token,
  platform = "android",
  deviceId = null,
  appVersion = null,
  client = db,
}) {
  const normalizedToken = normalizeToken(token);
  if (!normalizedToken) {
    const error = new Error("Token FCM invalido");
    error.statusCode = 400;
    throw error;
  }

  const result = await client.query(
    `
      INSERT INTO public.mobile_push_tokens (
        profile_id,
        token,
        platform,
        device_id,
        app_version
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (token) DO UPDATE
      SET
        profile_id = EXCLUDED.profile_id,
        platform = EXCLUDED.platform,
        device_id = EXCLUDED.device_id,
        app_version = EXCLUDED.app_version,
        disabled_at = null,
        last_seen_at = now()
      RETURNING *
    `,
    [
      profileId,
      normalizedToken,
      normalizePlatform(platform),
      deviceId?.toString().slice(0, 255) || null,
      appVersion?.toString().slice(0, 64) || null,
    ],
  );

  return result.rows[0];
}

export async function disableMobilePushToken({
  profileId,
  token,
  client = db,
}) {
  const normalizedToken = normalizeToken(token);
  if (!normalizedToken) {
    return null;
  }

  const result = await client.query(
    `
      UPDATE public.mobile_push_tokens
      SET disabled_at = COALESCE(disabled_at, now())
      WHERE profile_id = $1
        AND token = $2
      RETURNING *
    `,
    [profileId, normalizedToken],
  );

  return result.rows[0] ?? null;
}

async function disableInvalidTokens({ tokens, responses, client }) {
  const invalidTokens = responses
    .map((response, index) => ({
      token: tokens[index],
      code: response.error?.code,
    }))
    .filter((item) => invalidTokenErrorCodes.has(item.code))
    .map((item) => item.token);

  if (invalidTokens.length === 0) {
    return 0;
  }

  const result = await client.query(
    `
      UPDATE public.mobile_push_tokens
      SET disabled_at = COALESCE(disabled_at, now())
      WHERE token = ANY($1::text[])
      RETURNING id
    `,
    [invalidTokens],
  );

  return result.rowCount;
}

function summarizeFailureCodes(responses) {
  const counts = new Map();

  for (const response of responses) {
    const code = response.error?.code;
    if (!code) {
      continue;
    }

    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  return Array
    .from(counts.entries())
    .map(([code, count]) => `${code}:${count}`)
    .join(",");
}

export async function sendMobilePushToProfile({
  profileId,
  title,
  body = null,
  data = {},
  tag = null,
  client = db,
}) {
  const app = getFirebaseApp();
  if (!app) {
    return {
      sentCount: 0,
      failedCount: 0,
      disabledCount: 0,
      skippedReason: "mobile_push_not_configured",
    };
  }

  const result = await client.query(
    `
      SELECT token
      FROM public.mobile_push_tokens
      WHERE profile_id = $1
        AND disabled_at IS NULL
      ORDER BY updated_at DESC
      LIMIT 10
    `,
    [profileId],
  );
  const tokens = result.rows.map((row) => row.token);

  if (tokens.length === 0) {
    return {
      sentCount: 0,
      failedCount: 0,
      disabledCount: 0,
      skippedReason: "no_mobile_push_tokens",
    };
  }

  const message = {
    tokens,
    notification: body ? { title, body } : { title },
    data: getMessageData(data, tag),
    android: {
      priority: "high",
      notification: {
        tag: tag || undefined,
        clickAction: "FLUTTER_NOTIFICATION_CLICK",
      },
    },
  };

  const response = await getMessaging(app).sendEachForMulticast(message);
  const disabledCount = await disableInvalidTokens({
    tokens,
    responses: response.responses,
    client,
  });

  return {
    sentCount: response.successCount,
    failedCount: response.failureCount,
    disabledCount,
    skippedReason: response.successCount > 0
      ? null
      : `mobile_push_failed:${summarizeFailureCodes(response.responses) || "unknown"}`,
  };
}
