import { Router } from "express";
import { db } from "../db.js";
import { getUserFromRequest } from "../utils/auth.js";
import { asyncHandler, createBadRequest } from "../utils/http.js";
import { requireSignedBetaAccess } from "../middleware/beta-shield.js";

export const presenceRouter = Router();

const activeWindow = "2 minutes";
let presenceTableReady = false;

async function ensurePresenceTable() {
  if (presenceTableReady) {
    return;
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS public.app_presence (
      visitor_id text primary key,
      profile_id uuid references public.profiles(id) on delete set null,
      first_seen_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      user_agent text
    );

    CREATE INDEX IF NOT EXISTS app_presence_last_seen_idx
    ON public.app_presence(last_seen_at DESC);

    CREATE INDEX IF NOT EXISTS app_presence_profile_last_seen_idx
    ON public.app_presence(profile_id, last_seen_at DESC)
    WHERE profile_id IS NOT NULL;
  `);

  presenceTableReady = true;
}

function validateVisitorId(visitorId) {
  if (typeof visitorId !== "string") {
    return null;
  }

  const cleanVisitorId = visitorId.trim();

  if (!/^[a-zA-Z0-9:_-]{12,96}$/.test(cleanVisitorId)) {
    return null;
  }

  return cleanVisitorId;
}

async function getActiveCount() {
  const result = await db.query(`
    SELECT COUNT(DISTINCT COALESCE(profile_id::text, visitor_id))::integer AS active_count
    FROM public.app_presence
    WHERE last_seen_at >= now() - $1::interval
  `, [activeWindow]);

  return result.rows[0]?.active_count ?? 0;
}

presenceRouter.get("/", asyncHandler(async (req, res) => {
  requireSignedBetaAccess(req);
  await ensurePresenceTable();

  res.json({
    activeCount: await getActiveCount(),
    activeWindowSeconds: 120
  });
}));

presenceRouter.post("/heartbeat", asyncHandler(async (req, res) => {
  requireSignedBetaAccess(req);
  await ensurePresenceTable();

  const visitorId = validateVisitorId(req.body?.visitorId);

  if (!visitorId) {
    throw createBadRequest("visitorId inválido");
  }

  const user = getUserFromRequest(req);
  const userAgent = String(req.headers["user-agent"] ?? "").slice(0, 255) || null;

  await db.query(`
    INSERT INTO public.app_presence (visitor_id, profile_id, user_agent)
    VALUES ($1, $2, $3)
    ON CONFLICT (visitor_id)
    DO UPDATE SET
      profile_id = COALESCE(EXCLUDED.profile_id, public.app_presence.profile_id),
      last_seen_at = now(),
      user_agent = EXCLUDED.user_agent
  `, [visitorId, user?.id ?? null, userAgent]);

  res.json({
    activeCount: await getActiveCount(),
    activeWindowSeconds: 120
  });
}));
