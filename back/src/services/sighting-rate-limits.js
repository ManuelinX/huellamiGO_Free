import { db } from "../db.js";

const defaultLimits = {
  userReportHourly: 5,
  userReportCooldownSeconds: 60,
  ipReportHourly: 8,
  userGlobalHourly: 32,
  ipGlobalHourly: 60,
};

function readIntegerEnv(name, fallback, { min = 0 } = {}) {
  const value = Number.parseInt(process.env[name] ?? "", 10);

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(value, min);
}

function getSightingRateLimitConfig() {
  return {
    userReportHourly: readIntegerEnv(
      "SIGHTING_USER_REPORT_HOURLY_LIMIT",
      defaultLimits.userReportHourly,
    ),
    userReportCooldownSeconds: readIntegerEnv(
      "SIGHTING_USER_REPORT_COOLDOWN_SECONDS",
      defaultLimits.userReportCooldownSeconds,
    ),
    ipReportHourly: readIntegerEnv(
      "SIGHTING_IP_REPORT_HOURLY_LIMIT",
      defaultLimits.ipReportHourly,
    ),
    userGlobalHourly: readIntegerEnv(
      "SIGHTING_USER_GLOBAL_HOURLY_LIMIT",
      defaultLimits.userGlobalHourly,
    ),
    ipGlobalHourly: readIntegerEnv(
      "SIGHTING_IP_GLOBAL_HOURLY_LIMIT",
      defaultLimits.ipGlobalHourly,
    ),
  };
}

function createTooManySightingsError(reason, retryAfterSeconds = 3600) {
  const error = new Error("Recibimos muchos avistamientos en poco tiempo. Intenta de nuevo más tarde.");
  error.statusCode = 429;
  error.details = {
    reason,
    retryAfterSeconds,
  };
  error.publicDetails = {
    retryAfterSeconds,
  };
  return error;
}

async function countSightings({ whereSql, params, client }) {
  const result = await client.query(
    `
      SELECT count(*)::integer AS count
      FROM public.sightings
      WHERE ${whereSql}
    `,
    params,
  );

  return Number(result.rows[0]?.count ?? 0);
}

async function getLatestUserReportSighting({ profileId, reportId, client }) {
  const result = await client.query(
    `
      SELECT created_at
      FROM public.sightings
      WHERE profile_id = $1
        AND report_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [profileId, reportId],
  );

  return result.rows[0] ?? null;
}

export async function assertSightingRateLimits({
  profileId,
  reportId,
  ipAddress,
  client = db,
}) {
  const config = getSightingRateLimitConfig();
  const normalizedIpAddress = ipAddress || "unknown";
  const latestUserReportSighting = await getLatestUserReportSighting({
    profileId,
    reportId,
    client,
  });

  if (latestUserReportSighting && config.userReportCooldownSeconds > 0) {
    const elapsedSeconds = (Date.now() - new Date(latestUserReportSighting.created_at).getTime()) / 1000;
    const retryAfterSeconds = Math.ceil(config.userReportCooldownSeconds - elapsedSeconds);

    if (retryAfterSeconds > 0) {
      throw createTooManySightingsError("user_report_cooldown", retryAfterSeconds);
    }
  }

  const userReportCount = await countSightings({
    whereSql: "profile_id = $1 AND report_id = $2 AND created_at >= now() - interval '1 hour'",
    params: [profileId, reportId],
    client,
  });

  if (userReportCount >= config.userReportHourly) {
    throw createTooManySightingsError("user_report_hourly_limit");
  }

  const ipReportCount = await countSightings({
    whereSql: "report_id = $1 AND created_ip = $2 AND created_at >= now() - interval '1 hour'",
    params: [reportId, normalizedIpAddress],
    client,
  });

  if (ipReportCount >= config.ipReportHourly) {
    throw createTooManySightingsError("ip_report_hourly_limit");
  }

  const userGlobalCount = await countSightings({
    whereSql: "profile_id = $1 AND created_at >= now() - interval '1 hour'",
    params: [profileId],
    client,
  });

  if (userGlobalCount >= config.userGlobalHourly) {
    throw createTooManySightingsError("user_global_hourly_limit");
  }

  const ipGlobalCount = await countSightings({
    whereSql: "created_ip = $1 AND created_at >= now() - interval '1 hour'",
    params: [normalizedIpAddress],
    client,
  });

  if (ipGlobalCount >= config.ipGlobalHourly) {
    throw createTooManySightingsError("ip_global_hourly_limit");
  }
}
