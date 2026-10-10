import crypto from "crypto";
import { Router } from "express";
import { db } from "../db.js";
import { parseBbox } from "../services/map-clustering.js";
import { getMapReports } from "../services/report-map.js";
import {
  mapManagedReportRow,
  mapReportRow,
  mapSightingRow,
  managedReportColumns,
  publicReportColumns,
} from "../services/report-mapper.js";
import { notifyNearbyUsersAboutReport } from "../services/nearby-report-notifications.js";
import { createSighting } from "../services/sightings.js";
import { requireAuth, requireVerifiedEmail } from "../utils/auth.js";
import { asyncHandler, createBadRequest } from "../utils/http.js";
import { getPhotoContentTypeFromUrl, getStoragePathFromPublicUrl } from "../utils/photos.js";
import { requireBetaAccessForUser, requireSignedBetaAccess } from "../middleware/beta-shield.js";

export const reportsRouter = Router();
const shortFieldMaxLength = 32;
const descriptionMaxLength = 128;

function normalizeWhatsappNumber(value) {
  const rawValue = value?.toString().trim();

  if (!rawValue) {
    return null;
  }

  let digits = rawValue.replace(/[^\d]/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.length === 10) {
    digits = `52${digits}`;
  }

  if (digits.length < 10 || digits.length > 15) {
    return null;
  }

  return digits;
}

const reportSelect = `
  SELECT
    ${publicReportColumns},
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

const ownedReportSelect = `
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

function normalizeReportPayload(body) {
  const petLifeStage = body.pet_life_stage?.toString();

  return {
    pet_name: body.pet_name?.toString().trim(),
    pet_type: body.pet_type?.toString().trim(),
    description: body.description?.toString().trim() || null,
    zone: body.zone?.toString().trim() || null,
    last_seen_place: body.last_seen_place?.toString().trim() || null,
    last_seen_lat: Number(body.last_seen_lat),
    last_seen_lng: Number(body.last_seen_lng),
    reward_enabled: Boolean(body.reward_enabled),
    reward_show_amount: Boolean(body.reward_show_amount),
    reward_amount: body.reward_amount === null || body.reward_amount === undefined ? null : Number(body.reward_amount),
    reward_currency: body.reward_currency?.toString().trim() || "MXN",
    contact_name: body.contact_name?.toString().trim() || null,
    preferred_contact: body.preferred_contact?.toString().trim() || null,
    contact_value: body.contact_value?.toString().trim() || null,
    public_whatsapp: Boolean(body.public_whatsapp),
    is_vulnerable: Boolean(body.is_vulnerable),
    is_urgent: Boolean(body.is_urgent),
    needs_medication: Boolean(body.needs_medication),
    pet_life_stage: ["puppy", "adult", "senior"].includes(petLifeStage) ? petLifeStage : "adult",
    status: body.status || "active",
  };
}

function assertReportPayload(report) {
  if (!report.pet_name || !report.pet_type) {
    throw createBadRequest("Nombre y tipo de mascota son obligatorios");
  }


  if (report.public_whatsapp && !normalizeWhatsappNumber(report.contact_value)) {
    throw createBadRequest("Escribe un WhatsApp valido para mostrarlo en la alerta.");
  }
  if (!report.zone || !report.last_seen_place) {
    throw createBadRequest("Zona y lugar donde se vio por última vez son obligatorios");
  }

  const shortFields = [
    ["Nombre de la mascota", report.pet_name],
    ["Tipo de mascota", report.pet_type],
    ["Zona", report.zone],
    ["Lugar donde se vio por última vez", report.last_seen_place],
  ];

  const invalidShortField = shortFields.find(([, value]) => value.length > shortFieldMaxLength);

  if (invalidShortField) {
    throw createBadRequest(`${invalidShortField[0]} debe tener máximo ${shortFieldMaxLength} caracteres`);
  }

  if (report.description && report.description.length > descriptionMaxLength) {
    throw createBadRequest(`Descripción debe tener máximo ${descriptionMaxLength} caracteres`);
  }

  if (!Number.isFinite(report.last_seen_lat) || !Number.isFinite(report.last_seen_lng)) {
    throw createBadRequest("Ubicación inválida");
  }
}

function getPublicApiOrigin() {
  if (!process.env.PUBLIC_API_URL) {
    return null;
  }

  try {
    return new URL(process.env.PUBLIC_API_URL).origin;
  } catch {
    return null;
  }
}

function getRequestOrigin(req) {
  return `${req.protocol}://${req.get("host")}`;
}

function assertReportPhotoUrl(photoUrl, req) {
  if (!photoUrl || typeof photoUrl !== "string" || !photoUrl.trim()) {
    throw createBadRequest("La foto de la mascota es obligatoria.");
  }

  const trimmedPhotoUrl = photoUrl.trim();
  const allowedOrigins = new Set([
    getPublicApiOrigin(),
    getRequestOrigin(req),
  ].filter(Boolean));

  let parsedPhotoUrl;

  try {
    parsedPhotoUrl = trimmedPhotoUrl.startsWith("/")
      ? new URL(trimmedPhotoUrl, getRequestOrigin(req))
      : new URL(trimmedPhotoUrl);
  } catch {
    throw createBadRequest("La URL de la foto no es válida.");
  }

  if (!parsedPhotoUrl.pathname.startsWith("/uploads/pet-photos/")) {
    throw createBadRequest("La foto debe venir del almacenamiento de HuellamiGO.");
  }

  if (parsedPhotoUrl.protocol !== "http:" && parsedPhotoUrl.protocol !== "https:") {
    throw createBadRequest("La URL de la foto no es válida.");
  }

  if (!trimmedPhotoUrl.startsWith("/") && !allowedOrigins.has(parsedPhotoUrl.origin)) {
    throw createBadRequest("La foto debe venir del almacenamiento de HuellamiGO.");
  }

  if (!getPhotoContentTypeFromUrl(parsedPhotoUrl.pathname)) {
    throw createBadRequest("La foto debe estar optimizada en formato WebP o JPEG.");
  }
}

async function insertReportPhoto({ profileId, reportId, photoUrl, isPrimary = true, photoType = "report" }) {
  if (!photoUrl) {
    return;
  }

  const contentType = getPhotoContentTypeFromUrl(photoUrl) || "image/webp";

  await db.query(
    `
      INSERT INTO public.pet_photos (
        profile_id,
        report_id,
        public_url,
        storage_path,
        photo_type,
        is_primary,
        content_type
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [profileId, reportId, photoUrl, getStoragePathFromPublicUrl(photoUrl), photoType, isPrimary, contentType]
  );
}

reportsRouter.get("/", asyncHandler(async (req, res) => {
  requireSignedBetaAccess(req);
  const bbox = parseBbox(req.query.bbox);
  const status = req.query.status?.toString().trim() || "active";
  const where = ["r.status = $1"];
  const params = [status];

  if (bbox) {
    params.push(bbox.south, bbox.north, bbox.west, bbox.east);
    where.push(`
      r.last_seen_lat IS NOT NULL
      AND r.last_seen_lng IS NOT NULL
      AND r.last_seen_lat BETWEEN $2 AND $3
      AND r.last_seen_lng BETWEEN $4 AND $5
    `);
  }

  const result = await db.query(`
    ${reportSelect}
    WHERE ${where.join(" AND ")}
    ORDER BY r.created_at DESC
  `, params);

  res.json({
    ok: true,
    reports: result.rows.map(mapReportRow),
  });
}));

reportsRouter.get("/reunion-stories", asyncHandler(async (req, res) => {
  requireSignedBetaAccess(req);
  const result = await db.query(`
    ${reportSelect}
    WHERE r.status = 'reunited'
      AND r.reunion_public_allowed = true
      AND (
        r.reunion_message IS NOT NULL
        OR r.reunion_photo_url IS NOT NULL
        OR r.reunion_photo_url_2 IS NOT NULL
      )
    ORDER BY r.created_at DESC
    LIMIT 3
  `);

  res.json({
    ok: true,
    stories: result.rows.map(mapReportRow),
  });
}));

reportsRouter.get("/mine", asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  requireBetaAccessForUser(req, user);
  const result = await db.query(`
    ${ownedReportSelect}
    WHERE r.profile_id = $1
      AND r.status <> 'archived'
    ORDER BY r.created_at DESC
  `, [user.id]);

  res.json({
    ok: true,
    reports: result.rows.map(mapManagedReportRow),
  });
}));

reportsRouter.get("/map", asyncHandler(async (req, res) => {
  requireSignedBetaAccess(req);
  const bbox = parseBbox(req.query.bbox);
  const zoom = Number(req.query.zoom);
  const status = req.query.status?.toString().trim() || "active";

  if (!bbox) {
    throw createBadRequest("bbox es obligatorio");
  }

  if (!Number.isFinite(zoom)) {
    throw createBadRequest("zoom inválido");
  }

  const payload = await getMapReports({ bbox, zoom, status });

  res.json(payload);
}));

reportsRouter.post("/", asyncHandler(async (req, res) => {
  const user = await requireVerifiedEmail(req);
  requireBetaAccessForUser(req, user);
  const report = normalizeReportPayload(req.body);
  const photoUrl = req.body.photo_url?.toString().trim() || null;

  assertReportPayload(report);
  assertReportPhotoUrl(photoUrl, req);

  const manageToken = crypto.randomUUID();

  const result = await db.query(
    `
      INSERT INTO public.pet_reports (
        profile_id,
        pet_name,
        pet_type,
        description,
        zone,
        last_seen_place,
        last_seen_lat,
        last_seen_lng,
        reward_enabled,
        reward_show_amount,
        reward_amount,
        reward_currency,
        contact_name,
        preferred_contact,
        contact_value,
        public_whatsapp,
        is_vulnerable,
        is_urgent,
        needs_medication,
        pet_life_stage,
        status,
        manage_token
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22
      )
      RETURNING *
    `,
    [
      user.id,
      report.pet_name,
      report.pet_type,
      report.description,
      report.zone,
      report.last_seen_place,
      report.last_seen_lat,
      report.last_seen_lng,
      report.reward_enabled,
      report.reward_show_amount,
      report.reward_amount,
      report.reward_currency,
      report.contact_name,
      report.preferred_contact,
      report.contact_value,
      report.public_whatsapp,
      report.is_vulnerable,
      report.is_urgent,
      report.needs_medication,
      report.pet_life_stage,
      report.status,
      manageToken,
    ]
  );

  await insertReportPhoto({
    profileId: user.id,
    reportId: result.rows[0].id,
    photoUrl,
  });

  const hydrated = await db.query(`${reportSelect} WHERE r.id = $1 LIMIT 1`, [result.rows[0].id]);
  const hydratedReport = hydrated.rows[0];

  notifyNearbyUsersAboutReport({
    report: hydratedReport,
    actorProfileId: user.id,
  }).catch((error) => {
    console.error("No se pudieron crear alertas cercanas del reporte", {
      reportId: hydratedReport.id,
      error: error.message,
    });
  });

  res.status(201).json({
    ok: true,
    report: mapManagedReportRow({
      ...hydratedReport,
      manage_token: manageToken,
    }),
  });
}));

reportsRouter.get("/:id", asyncHandler(async (req, res) => {
  requireSignedBetaAccess(req);
  const result = await db.query(
    `
      ${reportSelect}
      WHERE r.id = $1
        AND r.status = 'active'
      LIMIT 1
    `,
    [req.params.id]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ ok: false, error: "Reporte no encontrado" });
    return;
  }

  res.json({
    ok: true,
    report: mapReportRow(result.rows[0]),
  });
}));

reportsRouter.get("/:id/sightings", asyncHandler(async (req, res) => {
  requireSignedBetaAccess(req);
  const includeHidden = req.query.includeHidden === "true";
  const statuses = includeHidden ? ["visible", "pending", "hidden"] : ["visible", "pending"];
  const result = await db.query(
    `
      SELECT
        s.*,
        p.public_url AS photo_url
      FROM public.sightings s
      LEFT JOIN public.pet_photos p ON p.id = s.photo_id
      WHERE s.report_id = $1
        AND s.status = ANY($2)
      ORDER BY s.created_at DESC
    `,
    [req.params.id, statuses]
  );

  res.json({
    ok: true,
    sightings: result.rows.map(mapSightingRow),
  });
}));

reportsRouter.post("/:id/sightings", asyncHandler(async (req, res) => {
  const user = await requireVerifiedEmail(req);
  requireBetaAccessForUser(req, user);
  const sighting = await createSighting({
    profileId: user.id,
    reportId: req.params.id,
    payload: req.body,
    ipAddress: req.ip || req.socket?.remoteAddress || "unknown",
  });

  res.status(201).json({
    ok: true,
    sighting: mapSightingRow(sighting),
  });
}));
