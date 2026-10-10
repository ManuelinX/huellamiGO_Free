import { Router } from "express";
import crypto from "crypto";
import { db } from "../db.js";
import { parseBbox } from "../services/map-clustering.js";
import { getManagedSightingMap } from "../services/manage-sighting-map.js";
import { managedReportColumns, mapManagedReportRow, mapSightingRow } from "../services/report-mapper.js";
import { asyncHandler, createBadRequest } from "../utils/http.js";
import { rateLimit } from "../utils/rate-limit.js";
import { requireSignedBetaAccess } from "../middleware/beta-shield.js";

export const manageRouter = Router();
const manageTokenHeader = "x-manage-token";
const manageSessionCookieName = "huellamigo_manage_session";
const manageSessionMaxAgeSeconds = 60 * 60 * 12;
const managedSightingsDefaultLimit = 80;
const managedSightingsMaxLimit = 120;
const maxTrailKeySightings = 5;
const reviewedZoneRadiusMeters = 500;
const reviewedZoneNoteMaxLength = 96;
const manageSessionRateLimit = rateLimit({
  name: "manage:session",
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Demasiados intentos de acceso privado. Intenta de nuevo mas tarde.",
});
const manageMutationRateLimit = rateLimit({
  name: "manage:mutation",
  windowMs: 15 * 60 * 1000,
  max: 90,
  message: "Demasiadas acciones de gestion. Intenta de nuevo mas tarde.",
});

function getManagedReportAccessCondition(alias = "r") {
  return `
    ${alias}.status <> 'archived'
    AND (
      ${alias}.status <> 'reunited'
      OR ${alias}.manage_expires_at IS NULL
      OR ${alias}.manage_expires_at > now()
    )
  `;
}

const managedReportSelect = `
  SELECT
    ${managedReportColumns},
    p.public_url AS photo_url,
    coalesce(sc.sightings_count, 0) AS sightings_count
  FROM public.pet_reports r
  LEFT JOIN LATERAL (
    SELECT public_url
    FROM public.pet_photos
    WHERE report_id = r.id
      AND photo_type = 'report'
    ORDER BY is_primary DESC, created_at DESC
    LIMIT 1
  ) p ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS sightings_count
    FROM public.sightings
    WHERE report_id = r.id
      AND status IN ('visible', 'pending')
  ) sc ON true
`;

async function getManagedReport(id, token) {
  const result = await db.query(
    `
      ${managedReportSelect}
      WHERE r.id = $1
        AND r.manage_token = $2
        AND ${getManagedReportAccessCondition("r")}
      LIMIT 1
    `,
    [id, token]
  );

  return result.rows[0] ?? null;
}

function getManageSessionSecret() {
  const secret = process.env.MANAGE_SESSION_SECRET
    || process.env.JWT_SECRET
    || process.env.BETA_SHIELD_SECRET;

  if (!secret) {
    throw new Error("MANAGE_SESSION_SECRET, JWT_SECRET o BETA_SHIELD_SECRET no configurado");
  }

  return secret;
}

function signPayload(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function createManageSessionToken({ reportId, token }) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    reportId,
    token,
    iat: issuedAt,
    exp: issuedAt + manageSessionMaxAgeSeconds,
  })).toString("base64url");
  const signature = signPayload(payload, getManageSessionSecret());

  return `${payload}.${signature}`;
}

function readCookie(req, name) {
  const cookies = req.headers.cookie?.split(";") ?? [];

  for (const cookie of cookies) {
    const [rawName, ...rawValueParts] = cookie.trim().split("=");

    if (rawName === name) {
      return decodeURIComponent(rawValueParts.join("="));
    }
  }

  return null;
}

function getManageSession(req, reportId) {
  const cookie = readCookie(req, manageSessionCookieName);

  if (!cookie) {
    return null;
  }

  const [payload, signature] = cookie.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(payload, getManageSessionSecret());
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);

    if (claims.reportId !== reportId || !claims.token || !Number.isSafeInteger(claims.exp) || claims.exp <= now) {
      return null;
    }

    return claims;
  } catch {
    return null;
  }
}

function setManageSessionCookie(res, sessionToken) {
  res.cookie(manageSessionCookieName, sessionToken, {
    path: "/",
    maxAge: manageSessionMaxAgeSeconds * 1000,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });
}

function getManageToken(req) {
  return req.get(manageTokenHeader)?.toString()
    || req.body?.manageToken?.toString()
    || req.query.token?.toString()
    || getManageSession(req, req.params.id)?.token;
}

function getManagedSightingsLimit(value) {
  const limit = Number(value ?? managedSightingsDefaultLimit);

  if (!Number.isFinite(limit)) {
    return managedSightingsDefaultLimit;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), managedSightingsMaxLimit);
}

function mapReviewedZoneRow(row) {
  return {
    id: row.id,
    reportId: row.report_id,
    lat: Number(row.lat),
    lng: Number(row.lng),
    coordinates: [Number(row.lat), Number(row.lng)],
    radiusM: Number(row.radius_m ?? reviewedZoneRadiusMeters),
    note: row.note ?? "",
    checkedAt: row.checked_at,
    createdAt: row.created_at,
  };
}

function normalizeReviewedZonePayload(body) {
  return {
    lat: Number(body.lat),
    lng: Number(body.lng),
    note: body.note?.toString().trim() || null,
    checkedAt: body.checkedAt?.toString() || body.checked_at?.toString() || null,
  };
}

function assertReviewedZonePayload(zone) {
  if (!Number.isFinite(zone.lat) || zone.lat < -90 || zone.lat > 90) {
    throw createBadRequest("Latitud inválida");
  }

  if (!Number.isFinite(zone.lng) || zone.lng < -180 || zone.lng > 180) {
    throw createBadRequest("Longitud inválida");
  }

  if (zone.note && zone.note.length > reviewedZoneNoteMaxLength) {
    throw createBadRequest(`La nota debe tener máximo ${reviewedZoneNoteMaxLength} caracteres`);
  }

  const checkedAtDate = new Date(zone.checkedAt);

  if (!zone.checkedAt || Number.isNaN(checkedAtDate.getTime())) {
    throw createBadRequest("Fecha de revisión inválida");
  }

  if (checkedAtDate.getTime() > Date.now() + 5 * 60 * 1000) {
    throw createBadRequest("La fecha de revisión no puede estar en el futuro");
  }

  return checkedAtDate;
}

manageRouter.post("/:id/session", manageSessionRateLimit, asyncHandler(async (req, res) => {
  requireSignedBetaAccess(req);
  const token = req.get(manageTokenHeader)?.toString()
    || req.body?.manageToken?.toString()
    || req.query.token?.toString();

  if (!token) {
    throw createBadRequest("Token requerido");
  }

  const report = await getManagedReport(req.params.id, token);

  if (!report) {
    res.status(404).json({ ok: false, error: "Reporte no encontrado" });
    return;
  }

  setManageSessionCookie(res, createManageSessionToken({ reportId: req.params.id, token }));

  res.json({
    ok: true,
    report: mapManagedReportRow(report),
  });
}));

manageRouter.get("/:id", asyncHandler(async (req, res) => {
  requireSignedBetaAccess(req);
  const token = getManageToken(req);

  if (!token) {
    throw createBadRequest("Token requerido");
  }

  const report = await getManagedReport(req.params.id, token);

  if (!report) {
    res.status(404).json({ ok: false, error: "Reporte no encontrado" });
    return;
  }

  res.json({
    ok: true,
    report: mapManagedReportRow(report),
  });
}));

manageRouter.get("/:id/sightings", asyncHandler(async (req, res) => {
  requireSignedBetaAccess(req);
  const token = getManageToken(req);
  const limit = getManagedSightingsLimit(req.query.limit);

  if (!token) {
    throw createBadRequest("Token requerido");
  }

  const result = await db.query(
    `
      SELECT
        s.*,
        p.public_url AS photo_url
      FROM public.sightings s
      LEFT JOIN public.pet_photos p ON p.id = s.photo_id
      WHERE s.report_id = $1
        AND s.status = ANY($3)
        AND EXISTS (
          SELECT 1
          FROM public.pet_reports r
          WHERE r.id = $1
            AND r.manage_token = $2
            AND ${getManagedReportAccessCondition("r")}
        )
      ORDER BY s.is_trail_key DESC, s.is_useful DESC, s.created_at DESC
      LIMIT $4
    `,
    [req.params.id, token, ["visible", "pending", "hidden"], limit],
  );

  res.json({
    ok: true,
    limit,
    sightings: result.rows.map(mapSightingRow),
  });
}));

manageRouter.get("/:id/sightings/map", asyncHandler(async (req, res) => {
  requireSignedBetaAccess(req);
  const token = getManageToken(req);
  const bbox = parseBbox(req.query.bbox);
  const zoom = Number(req.query.zoom);

  if (!token) {
    throw createBadRequest("Token requerido");
  }

  if (!bbox) {
    throw createBadRequest("bbox es obligatorio");
  }

  if (!Number.isFinite(zoom)) {
    throw createBadRequest("zoom inválido");
  }

  const report = await getManagedReport(req.params.id, token);

  if (!report) {
    res.status(404).json({ ok: false, error: "Reporte no encontrado" });
    return;
  }

  const payload = await getManagedSightingMap({
    reportId: req.params.id,
    bbox,
    zoom,
  });

  res.json(payload);
}));

manageRouter.get("/:id/reviewed-zones", asyncHandler(async (req, res) => {
  requireSignedBetaAccess(req);
  const token = getManageToken(req);

  if (!token) {
    throw createBadRequest("Token requerido");
  }

  const report = await getManagedReport(req.params.id, token);

  if (!report) {
    res.status(404).json({ ok: false, error: "Reporte no encontrado" });
    return;
  }

  const result = await db.query(
    `
      SELECT *
      FROM public.reviewed_search_zones
      WHERE report_id = $1
      ORDER BY checked_at DESC, created_at DESC
    `,
    [req.params.id],
  );

  res.json({
    ok: true,
    zones: result.rows.map(mapReviewedZoneRow),
  });
}));

manageRouter.post("/:id/reviewed-zones", manageMutationRateLimit, asyncHandler(async (req, res) => {
  requireSignedBetaAccess(req);
  const token = getManageToken(req);

  if (!token) {
    throw createBadRequest("Token requerido");
  }

  const report = await getManagedReport(req.params.id, token);

  if (!report) {
    res.status(404).json({ ok: false, error: "Reporte no encontrado" });
    return;
  }

  const zone = normalizeReviewedZonePayload(req.body);
  const checkedAtDate = assertReviewedZonePayload(zone);
  const result = await db.query(
    `
      INSERT INTO public.reviewed_search_zones (
        report_id,
        checked_at,
        lat,
        lng,
        radius_m,
        note
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      req.params.id,
      checkedAtDate.toISOString(),
      zone.lat,
      zone.lng,
      reviewedZoneRadiusMeters,
      zone.note,
    ],
  );

  res.status(201).json({
    ok: true,
    zone: mapReviewedZoneRow(result.rows[0]),
  });
}));

manageRouter.delete("/:id/reviewed-zones/:zoneId", manageMutationRateLimit, asyncHandler(async (req, res) => {
  requireSignedBetaAccess(req);
  const token = getManageToken(req);

  if (!token) {
    throw createBadRequest("Token requerido");
  }

  const report = await getManagedReport(req.params.id, token);

  if (!report) {
    res.status(404).json({ ok: false, error: "Reporte no encontrado" });
    return;
  }

  const result = await db.query(
    `
      DELETE FROM public.reviewed_search_zones
      WHERE id = $1
        AND report_id = $2
      RETURNING id
    `,
    [req.params.zoneId, req.params.id],
  );

  if (result.rows.length === 0) {
    res.status(404).json({ ok: false, error: "Zona revisada no encontrada" });
    return;
  }

  res.json({
    ok: true,
    deletedId: result.rows[0].id,
  });
}));

manageRouter.patch("/:id/status", manageMutationRateLimit, asyncHandler(async (req, res) => {
  requireSignedBetaAccess(req);
  const token = getManageToken(req);
  const status = req.body.status?.toString();

  if (!token) {
    throw createBadRequest("Token requerido");
  }

  if (!["active", "reunited", "archived"].includes(status)) {
    throw createBadRequest("Estado inválido");
  }

  const result = await db.query(
    `
      UPDATE public.pet_reports r
      SET
        status = $3,
        manage_token = CASE
          WHEN $3 = 'archived' THEN NULL
          ELSE manage_token
        END,
        manage_expires_at = CASE
          WHEN $3 = 'reunited' THEN now() + interval '7 days'
          WHEN $3 IN ('active', 'archived') THEN NULL
          ELSE manage_expires_at
        END,
        reunion_photo_url = CASE
          WHEN $3 = 'reunited' THEN $4
          WHEN $3 = 'active' THEN NULL
          ELSE reunion_photo_url
        END,
        reunion_photo_url_2 = CASE
          WHEN $3 = 'reunited' THEN $5
          WHEN $3 = 'active' THEN NULL
          ELSE reunion_photo_url_2
        END,
        reunion_message = CASE
          WHEN $3 = 'reunited' THEN nullif(left($6, 180), '')
          WHEN $3 = 'active' THEN NULL
          ELSE reunion_message
        END,
        reunion_public_allowed = CASE
          WHEN $3 = 'reunited' THEN $7
          WHEN $3 = 'active' THEN false
          ELSE reunion_public_allowed
        END
      WHERE r.id = $1
        AND r.manage_token = $2
        AND ${getManagedReportAccessCondition("r")}
      RETURNING *
    `,
    [
      req.params.id,
      token,
      status,
      req.body.reunionStory?.photoUrl ?? null,
      req.body.reunionStory?.photoUrl2 ?? null,
      req.body.reunionStory?.message ?? null,
      Boolean(req.body.reunionStory?.publicAllowed),
    ]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ ok: false, error: "Reporte no encontrado" });
    return;
  }

  const hydrated = await getManagedReport(req.params.id, token);

  res.json({
    ok: true,
    report: mapManagedReportRow(hydrated ?? result.rows[0]),
  });
}));

manageRouter.patch("/:id/sightings/:sightingId", manageMutationRateLimit, asyncHandler(async (req, res) => {
  requireSignedBetaAccess(req);
  const token = getManageToken(req);
  const status = req.body.status?.toString();
  const nextIsTrailKey = Boolean(req.body.isTrailKey);

  if (!token) {
    throw createBadRequest("Token requerido");
  }

  if (!["visible", "pending", "hidden"].includes(status)) {
    throw createBadRequest("Estado inválido");
  }

  const nextIsUseful = status === "hidden"
    ? false
    : Boolean(req.body.isUseful) || nextIsTrailKey;
  const normalizedIsTrailKey = status === "hidden" ? false : nextIsTrailKey;
  const client = await db.connect();
  let result;

  try {
    await client.query("BEGIN");

    const reportResult = await client.query(
      `
        SELECT id
        FROM public.pet_reports r
        WHERE r.id = $1
          AND r.manage_token = $2
          AND ${getManagedReportAccessCondition("r")}
        LIMIT 1
        FOR UPDATE
      `,
      [req.params.id, token],
    );

    if (reportResult.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ ok: false, error: "Reporte no encontrado" });
      return;
    }

    if (normalizedIsTrailKey) {
      const trailKeyCountResult = await client.query(
        `
          SELECT count(*)::integer AS count
          FROM public.sightings
          WHERE report_id = $1
            AND id <> $2
            AND is_trail_key = true
            AND status <> 'hidden'
        `,
        [req.params.id, req.params.sightingId],
      );

      if (Number(trailKeyCountResult.rows[0]?.count ?? 0) >= maxTrailKeySightings) {
        throw createBadRequest(`Solo puedes tener ${maxTrailKeySightings} pistas clave activas.`);
      }
    }

    result = await client.query(
      `
        UPDATE public.sightings s
        SET
          status = $3,
          is_useful = $4,
          is_trail_key = $5
        WHERE s.id = $2
          AND s.report_id = $1
        RETURNING s.*
      `,
      [
        req.params.id,
        req.params.sightingId,
        status,
        nextIsUseful,
        normalizedIsTrailKey,
      ],
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ ok: false, error: "Avistamiento no encontrado" });
      return;
    }

    const photoResult = await client.query(
      `
        SELECT
          s.*,
          p.public_url AS photo_url
        FROM public.sightings s
        LEFT JOIN public.pet_photos p ON p.id = s.photo_id
        WHERE s.id = $1
        LIMIT 1
      `,
      [result.rows[0].id],
    );

    await client.query("COMMIT");

    res.json({
      ok: true,
      sighting: mapSightingRow(photoResult.rows[0] ?? result.rows[0]),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));
