export const publicReportColumns = `
  r.id,
  r.created_at,
  r.pet_name,
  r.pet_type,
  r.description,
  r.zone,
  r.last_seen_place,
  r.last_seen_lat,
  r.last_seen_lng,
  r.reward_enabled,
  r.reward_show_amount,
  r.reward_amount,
  r.reward_currency,
  r.contact_name,
  r.preferred_contact,
  r.contact_value,
  r.public_whatsapp,
  r.is_vulnerable,
  r.is_urgent,
  r.needs_medication,
  r.pet_life_stage,
  r.status,
  r.reunion_photo_url,
  r.reunion_photo_url_2,
  r.reunion_message,
  r.reunion_public_allowed,
  r.manage_expires_at
`;

export const managedReportColumns = `
  ${publicReportColumns},
  r.manage_token
`;

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

function getWhatsappUrl(row) {
  if (!row.public_whatsapp) {
    return null;
  }

  const phoneNumber = normalizeWhatsappNumber(row.contact_value);

  if (!phoneNumber) {
    return null;
  }

  const message = encodeURIComponent(`Hola, vi el reporte de ${row.pet_name} en HuellamiGO.`);

  return `https://wa.me/${phoneNumber}?text=${message}`;
}

export function mapReportRow(row) {
  const whatsappUrl = getWhatsappUrl(row);

  return {
    id: row.id,
    slug: row.id,
    createdAt: row.created_at,
    name: row.pet_name,
    species: row.pet_type,
    zone: row.zone ?? "Zona no especificada",
    lastSeenWhen: "Reciente",
    status: row.status,
    sightingsCount: Number(row.sightings_count ?? 0),
    manageExpiresAt: row.manage_expires_at,
    reunionStory: {
      photoUrl: row.reunion_photo_url,
      photoUrl2: row.reunion_photo_url_2,
      message: row.reunion_message,
      publicAllowed: row.reunion_public_allowed,
    },
    avatarClass: "avatarNina",
    shortDescription: row.description ?? "Sin descripción.",
    description: row.description ?? "Sin descripción.",
    coordinates: [
      row.last_seen_lat ?? 19.41273,
      row.last_seen_lng ?? -99.16988,
    ],
    reward: {
      enabled: row.reward_enabled,
      showAmount: row.reward_show_amount && Number(row.reward_amount) > 0,
      amount: row.reward_amount,
      currency: row.reward_currency ?? "MXN",
    },
    prioritySignals: {
      isVulnerable: Boolean(row.is_vulnerable),
      isUrgent: Boolean(row.is_urgent),
      needsMedication: Boolean(row.needs_medication),
      lifeStage: row.pet_life_stage ?? "adult",
    },
    contact: {
      name: row.contact_name ?? "Familia",
      preferredMethod: row.preferred_contact ?? "Mensaje por HuellamiGO",
      publicWhatsapp: Boolean(whatsappUrl),
      masked: whatsappUrl ? "WhatsApp disponible" : "Contacto protegido",
      whatsappUrl,
    },
    photoUrl: row.photo_url ?? null,
  };
}

export function mapManagedReportRow(row) {
  return {
    ...mapReportRow(row),
    manageToken: row.manage_token,
  };
}

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

export function mapSightingRow(row) {
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  const confidenceScore = Number(row.trust_score ?? row.confidence_score ?? row.trustScore ?? 40);
  const status = row.status ?? "pending";

  return {
    id: row.id,
    reportId: row.report_id,
    comment: row.comment ?? "",
    seenAt: row.seen_at,
    lat,
    lng,
    coordinates: [lat, lng],
    photoUrl: row.photo_url ?? null,
    contactName: row.contact_name,
    status,
    confidence: getSightingConfidenceLevel(confidenceScore),
    confidenceScore,
    isUseful: Boolean(row.is_useful),
    isTrailKey: Boolean(row.is_trail_key),
    isHidden: status === "hidden",
    trustScore: confidenceScore,
    sourceType: row.source_type ?? "normal",
    createdAt: row.created_at,
  };
}
