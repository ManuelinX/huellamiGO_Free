import dotenv from "dotenv";

dotenv.config();

function readBoolean(name, fallback = false) {
  const value = process.env[name];

  if (value === undefined || value === "") {
    return fallback;
  }

  return value === "true";
}

function readInteger(name, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  const value = Number.parseInt(process.env[name] ?? "", 10);

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
}

function readNumber(name, fallback, { min = -Infinity, max = Infinity } = {}) {
  const value = Number(process.env[name]);

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
}

function readList(name, fallback = []) {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getWebPushSubject() {
  const emailFromMatch = process.env.EMAIL_FROM?.match(/[^\s<>]+@[^\s<>]+/);

  return process.env.WEB_PUSH_SUBJECT
    || (emailFromMatch ? `mailto:${emailFromMatch[0]}` : null)
    || "mailto:contacto@example.com";
}

const databaseUrl = process.env.DATABASE_URL || "";
const connectsToLocalDatabase = /localhost|127\.0\.0\.1/.test(databaseUrl);

export const config = {
  cors: {
    allowedOrigins: readList("CORS_ORIGIN", ["http://localhost:3000"]),
  },
  database: {
    url: databaseUrl,
    ssl: process.env.DATABASE_SSL
      ? readBoolean("DATABASE_SSL")
      : !connectsToLocalDatabase,
  },
  postgis: {
    schema: process.env.POSTGIS_SCHEMA || "gis",
  },
  geocoding: {
    mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN || "",
    mapboxEnabled: readBoolean("MAPBOX_GEOCODING_ENABLED", false),
    monthlyLimit: readInteger("MAPBOX_GEOCODING_MONTHLY_LIMIT", 90000, { min: 0 }),
    cacheRadiusMeters: readNumber("GEOCODING_CACHE_RADIUS_METERS", 30, { min: 1, max: 1000 }),
    cacheTtlDays: readInteger("GEOCODING_CACHE_TTL_DAYS", 180, { min: 1 }),
    cacheMaxRows: readInteger("GEOCODING_CACHE_MAX_ROWS", 250000, { min: 1000 }),
  },
  webPush: {
    publicKey: process.env.WEB_PUSH_VAPID_PUBLIC_KEY || "",
    privateKey: process.env.WEB_PUSH_VAPID_PRIVATE_KEY || "",
    subject: getWebPushSubject(),
  },
};
