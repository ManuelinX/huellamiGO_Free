import { db } from "../db.js";

const cleanupIntervalMs = 5 * 60 * 1000;
let lastCleanupAt = 0;
let ensureTablePromise = null;

function ensureRateLimitTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = db.query(`
      CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
        key text PRIMARY KEY,
        count integer NOT NULL DEFAULT 0,
        reset_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS rate_limit_buckets_reset_at_idx
        ON public.rate_limit_buckets (reset_at);
    `).catch((error) => {
      ensureTablePromise = null;
      throw error;
    });
  }

  return ensureTablePromise;
}

function cleanupExpiredBuckets(now) {
  if (now - lastCleanupAt < cleanupIntervalMs) {
    return;
  }

  lastCleanupAt = now;

  db.query(`
    DELETE FROM public.rate_limit_buckets
    WHERE reset_at <= now() - interval '1 hour'
  `).catch((error) => {
    console.error("No se pudo limpiar rate_limit_buckets", error);
  });
}

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function getLimitKey(req, name, keyGenerator) {
  if (keyGenerator) {
    const identity = keyGenerator(req);

    return identity ? `${name}:${identity}` : null;
  }

  return `${name}:ip:${getClientIp(req)}`;
}

async function incrementBucket({ key, windowMs }) {
  const result = await db.query(
    `
      WITH request_time AS (
        SELECT now() AS at
      ),
      upserted AS (
        INSERT INTO public.rate_limit_buckets (key, count, reset_at, updated_at)
        SELECT
          $1,
          1,
          request_time.at + ($2::double precision * interval '1 millisecond'),
          request_time.at
        FROM request_time
        ON CONFLICT (key) DO UPDATE SET
          count = CASE
            WHEN public.rate_limit_buckets.reset_at <= (SELECT at FROM request_time) THEN 1
            ELSE public.rate_limit_buckets.count + 1
          END,
          reset_at = CASE
            WHEN public.rate_limit_buckets.reset_at <= (SELECT at FROM request_time)
              THEN (SELECT at FROM request_time) + ($2::double precision * interval '1 millisecond')
            ELSE public.rate_limit_buckets.reset_at
          END,
          updated_at = (SELECT at FROM request_time)
        RETURNING count, reset_at
      )
      SELECT
        upserted.count,
        GREATEST(CEIL(EXTRACT(EPOCH FROM (upserted.reset_at - request_time.at))), 0)::integer
          AS retry_after_seconds,
        CEIL(EXTRACT(EPOCH FROM upserted.reset_at))::integer AS reset_at_epoch
      FROM upserted, request_time
    `,
    [key, windowMs],
  );

  return result.rows[0];
}

export function rateLimit({ name, windowMs, max, message, keyGenerator }) {
  return async (req, res, next) => {
    try {
      await ensureRateLimitTable();
      cleanupExpiredBuckets(Date.now());

      const key = getLimitKey(req, name, keyGenerator);
      if (!key) {
        next();
        return;
      }

      const bucket = await incrementBucket({ key, windowMs });
      const count = Number(bucket.count);
      const remaining = Math.max(max - count, 0);
      const retryAfterSeconds = Number(bucket.retry_after_seconds);

      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", String(remaining));
      res.setHeader("X-RateLimit-Reset", String(bucket.reset_at_epoch));

      if (count > max) {
        const error = new Error(message || "Demasiados intentos. Intenta de nuevo más tarde.");
        error.statusCode = 429;
        error.details = {
          retryAfterSeconds,
        };
        error.publicDetails = {
          retryAfterSeconds,
        };
        res.setHeader("Retry-After", String(retryAfterSeconds));
        next(error);
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
