import { db } from "../db.js";
import { enqueueNearbySightingUpdateWindow } from "./nearby-sighting-update-notifications.js";
import { handleSightingCreated } from "./sighting-notifications.js";
import { assertSightingRateLimits } from "./sighting-rate-limits.js";
import { createBadRequest } from "../utils/http.js";
import { getPhotoContentTypeFromUrl, getStoragePathFromPublicUrl } from "../utils/photos.js";

function normalizeSightingPayload(body) {
  const comment = body.comment || null;
  const contactName = body.contact_name || null;
  const photoUrl = body.photo_url || null;
  const trustScore = Math.min(
    100,
    35 + (photoUrl ? 25 : 0) + (comment ? 15 : 0) + (contactName ? 10 : 0),
  );

  return {
    lat: Number(body.lat),
    lng: Number(body.lng),
    photoUrl,
    comment,
    contactName,
    trustScore,
    sourceType: "normal",
    status: trustScore >= 30 ? "visible" : "pending",
  };
}

function assertSightingPayload(sighting) {
  if (!Number.isFinite(sighting.lat) || !Number.isFinite(sighting.lng)) {
    throw createBadRequest("Ubicación inválida");
  }
}

async function insertSightingPhoto({ profileId, reportId, photoUrl, client = db }) {
  if (!photoUrl) {
    return null;
  }

  const contentType = getPhotoContentTypeFromUrl(photoUrl) || "image/webp";

  const result = await client.query(
    `
      INSERT INTO public.pet_photos (
        profile_id,
        report_id,
        public_url,
        storage_path,
        photo_type,
        content_type
      )
      VALUES ($1, $2, $3, $4, 'sighting', $5)
      RETURNING id
    `,
    [profileId, reportId, photoUrl, getStoragePathFromPublicUrl(photoUrl), contentType],
  );

  return result.rows[0].id;
}

async function createSightingWithClient({ profileId, reportId, payload, ipAddress = null, client }) {
  const sighting = normalizeSightingPayload(payload);

  assertSightingPayload(sighting);
  await assertSightingRateLimits({
    profileId,
    reportId,
    ipAddress,
    client,
  });

  const photoId = await insertSightingPhoto({
    profileId,
    reportId,
    photoUrl: sighting.photoUrl,
    client,
  });

  const result = await client.query(
    `
      INSERT INTO public.sightings (
        profile_id,
        report_id,
        photo_id,
        lat,
        lng,
        comment,
        contact_name,
        created_ip,
        status,
        trust_score,
        source_type
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `,
    [
      profileId,
      reportId,
      photoId,
      sighting.lat,
      sighting.lng,
      sighting.comment,
      sighting.contactName,
      ipAddress,
      sighting.status,
      sighting.trustScore,
      sighting.sourceType,
    ],
  );

  const createdSighting = {
    ...result.rows[0],
    photo_url: sighting.photoUrl,
  };

  await handleSightingCreated({
    reportId,
    sighting: createdSighting,
    actorProfileId: profileId,
    client,
  });
  await enqueueNearbySightingUpdateWindow({
    reportId,
    sighting: createdSighting,
    client,
  });

  return createdSighting;
}

export async function createSighting({ profileId, reportId, payload, ipAddress = null, client = null }) {
  if (client) {
    return createSightingWithClient({ profileId, reportId, payload, ipAddress, client });
  }

  const transaction = await db.connect();

  try {
    await transaction.query("BEGIN");

    const sighting = await createSightingWithClient({
      profileId,
      reportId,
      payload,
      ipAddress,
      client: transaction,
    });

    await transaction.query("COMMIT");
    return sighting;
  } catch (error) {
    await transaction.query("ROLLBACK");
    throw error;
  } finally {
    transaction.release();
  }
}
