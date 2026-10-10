import { uploadPetPhoto } from "@/lib/reports";
import { apiFetch } from "@/lib/api";

export function getSightingConfidenceLevel(score) {
  const confidenceScore = Number(score ?? 40);

  if (confidenceScore >= 75) {
    return "high";
  }

  if (confidenceScore >= 50) {
    return "medium";
  }

  return "low";
}

export function getSightingConfidenceLabel(sighting) {
  const confidence = sighting.confidence ?? getSightingConfidenceLevel(sighting.confidenceScore ?? sighting.trustScore);

  if (confidence === "high") {
    return "Alta";
  }

  if (confidence === "medium") {
    return "Media";
  }

  return "Baja";
}

export function getSightingStatusLabel(sighting) {
  if (sighting.isHidden || sighting.status === "hidden") {
    return "No me sirve";
  }

  if (sighting.isTrailKey) {
    return "Pista clave";
  }

  if (sighting.isUseful) {
    return "Marcado útil";
  }

  return sighting.status === "pending" ? "Pendiente" : "Visible";
}

function getSightingLat(row) {
  return Number(row.lat ?? row.coordinates?.[0]);
}

function getSightingLng(row) {
  return Number(row.lng ?? row.coordinates?.[1]);
}

export function normalizeSighting(row) {
  const lat = getSightingLat(row);
  const lng = getSightingLng(row);
  const status = row.status ?? "pending";
  const confidenceScore = Number(row.confidenceScore ?? row.trustScore ?? row.trust_score ?? 40);

  return {
    id: row.id,
    reportId: row.reportId ?? row.report_id,
    comment: row.comment ?? "",
    seenAt: row.seenAt ?? row.seen_at ?? row.createdAt ?? row.created_at,
    lat,
    lng,
    coordinates: [lat, lng],
    photoUrl: row.photoUrl ?? row.pet_photos?.public_url ?? row.photo_url ?? null,
    contactName: row.contactName ?? row.contact_name ?? null,
    status,
    confidence: row.confidence ?? getSightingConfidenceLevel(confidenceScore),
    confidenceScore,
    isUseful: Boolean(row.isUseful ?? row.is_useful),
    isTrailKey: Boolean(row.isTrailKey ?? row.is_trail_key),
    isHidden: Boolean(row.isHidden ?? status === "hidden"),
    trustScore: confidenceScore,
    sourceType: row.sourceType ?? row.source_type ?? "normal",
    createdAt: row.createdAt ?? row.created_at,
  };
}

export const mapSighting = normalizeSighting;

export async function getSightings(reportId, { includeHidden = false } = {}) {
  const data = await apiFetch(`/api/reports/${reportId}/sightings?includeHidden=${includeHidden}`);
  return data.sightings.map(normalizeSighting);
}

export async function createSighting({
  reportId,
  lat,
  lng,
  comment,
  contactName,
  photo,
  trustScore = 40,
}) {
  const photoUrl = photo instanceof File ? await uploadPetPhoto(photo) : null;
  const data = await apiFetch(`/api/reports/${reportId}/sightings`, {
    method: "POST",
    auth: true,
    body: {
      lat,
      lng,
      comment,
      contact_name: contactName,
      photo_url: photoUrl,
      trust_score: trustScore,
      source_type: "normal",
    },
  });

  return normalizeSighting(data.sighting);
}
