export const notificationTypes = {
  nearbyReport: "nearby_report",
  nearbySighting: "nearby_sighting",
  reportUpdate: "report_update",
  system: "system",
};

export const notificationChannels = {
  inApp: "in_app",
  webPush: "web_push",
  mobilePush: "mobile_push",
  email: "email",
};

export const reportNotificationPriorityLevels = {
  high: "high",
  medium: "medium",
  low: "low",
  none: "none",
};

const reportPriorityRadiusKm = {
  [reportNotificationPriorityLevels.high]: 7,
  [reportNotificationPriorityLevels.medium]: 4,
  [reportNotificationPriorityLevels.low]: 1.5,
  [reportNotificationPriorityLevels.none]: 0,
};

const trustedSightingThreshold = 80;
const nearbySightingUpdateTrustThreshold = 60;
const nearbySightingUpdateDistanceMeters = 1000;
const nearbySightingUpdateRadiusKm = 2;

function getHoursSince(value, now = new Date()) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Math.max(0, (now.getTime() - date.getTime()) / (60 * 60 * 1000));
}

function hasClearReportLocation(report) {
  return (
    Number.isFinite(Number(report.last_seen_lat)) &&
    Number.isFinite(Number(report.last_seen_lng)) &&
    Boolean(report.zone || report.last_seen_place)
  );
}

function hasReportPhoto(report) {
  return Boolean(report.photo_url || report.photoUrl || report.has_photo || report.hasPhoto);
}

function hasRecentSightings(report) {
  return Number(report.sightings_count ?? report.sightingsCount ?? 0) > 0;
}

function isVulnerableOrUrgentReport(report) {
  const lifeStage = report.pet_life_stage ?? report.petLifeStage;

  return Boolean(
    report.is_vulnerable
      || report.isVulnerable
      || report.is_urgent
      || report.isUrgent
      || report.needs_medication
      || report.needsMedication
      || lifeStage === "puppy"
      || lifeStage === "senior",
  );
}

export function calculateReportNotificationPriority(report, { now = new Date() } = {}) {
  const reasons = [];
  let score = 0;
  const referenceTime = report.last_seen_at ?? report.lastSeenAt ?? report.created_at ?? report.createdAt;
  const lostHours = getHoursSince(referenceTime, now);

  if (lostHours !== null && lostHours <= 6) {
    score += 30;
    reasons.push("recent_6h");
  } else if (lostHours !== null && lostHours <= 48) {
    score += 15;
    reasons.push("recent_48h");
  }

  if (hasReportPhoto(report)) {
    score += 20;
    reasons.push("has_photo");
  }

  if (hasClearReportLocation(report)) {
    score += 20;
    reasons.push("clear_location");
  }

  if (isVulnerableOrUrgentReport(report)) {
    score += 20;
    reasons.push("vulnerable_or_urgent");
  }

  if (hasRecentSightings(report)) {
    score += 20;
    reasons.push("recent_sightings");
  }

  const level = score >= 70
    ? reportNotificationPriorityLevels.high
    : score >= 35
      ? reportNotificationPriorityLevels.medium
      : score > 0
        ? reportNotificationPriorityLevels.low
        : reportNotificationPriorityLevels.none;

  return {
    score,
    level,
    radiusKm: reportPriorityRadiusKm[level],
    shouldPush: level !== reportNotificationPriorityLevels.none,
    reasons,
  };
}

export function getSightingNotificationDecision(sighting) {
  const trustScore = Number(sighting.trust_score ?? sighting.trustScore ?? 40);
  const sourceType = sighting.source_type ?? sighting.sourceType ?? null;
  const trustedSourceTypes = new Set(["verified_business", "rescuer", "trusted"]);

  if (trustedSourceTypes.has(sourceType) || trustScore >= trustedSightingThreshold) {
    return {
      mode: "immediate",
      reason: trustedSourceTypes.has(sourceType) ? "trusted_source_type" : "trusted_score",
      trustScore,
      sourceType,
    };
  }

  return {
    mode: "digest",
    reason: "normal_trust_digest",
    trustScore,
    sourceType,
  };
}

export function getNearbySightingUpdateDecision({ report, sighting, distanceMeters }) {
  const trustScore = Number(sighting.trust_score ?? sighting.trustScore ?? 40);
  const sourceType = sighting.source_type ?? sighting.sourceType ?? null;
  const trustedSourceTypes = new Set(["verified_business", "rescuer", "trusted"]);
  const trustedEnough = trustedSourceTypes.has(sourceType) || trustScore >= nearbySightingUpdateTrustThreshold;

  if (report.status && report.status !== "active") {
    return {
      shouldNotify: false,
      reason: "report_not_active",
      trustScore,
      sourceType,
      distanceMeters,
    };
  }

  if (!trustedEnough) {
    return {
      shouldNotify: false,
      reason: "low_trust_sighting",
      trustScore,
      sourceType,
      distanceMeters,
    };
  }

  if (distanceMeters < nearbySightingUpdateDistanceMeters) {
    return {
      shouldNotify: false,
      reason: "same_probable_zone",
      trustScore,
      sourceType,
      distanceMeters,
    };
  }

  return {
    shouldNotify: true,
    reason: "new_probable_zone",
    trustScore,
    sourceType,
    distanceMeters,
    radiusKm: nearbySightingUpdateRadiusKm,
  };
}

export function getNotificationDedupeKey(type, { reportId, sightingId } = {}) {
  if (type === notificationTypes.nearbyReport) {
    return `${type}:${reportId}`;
  }

  if (type === notificationTypes.nearbySighting) {
    return `${type}:${sightingId}`;
  }

  return `${type}:${reportId ?? sightingId ?? "global"}`;
}

export function getNearbyReportNotification({ report, recipient }) {
  const type = notificationTypes.nearbyReport;
  const priority = recipient.priority ?? calculateReportNotificationPriority(report);
  const body = report.zone
    ? `${report.pet_name} fue reportada cerca de ${report.zone}.`
    : `${report.pet_name} fue reportada cerca de tu zona.`;

  return {
    type,
    dedupeKey: getNotificationDedupeKey(type, { reportId: report.id }),
    title: "Mascota perdida cerca de ti",
    body,
    data: {
      reportId: report.id,
      petName: report.pet_name,
      petType: report.pet_type,
      zone: report.zone ?? null,
      lat: report.last_seen_lat,
      lng: report.last_seen_lng,
      distanceMeters: Math.round(Number(recipient.distance_meters ?? 0)),
      effectiveRadiusKm: Number(recipient.effective_radius_km ?? recipient.radius_km),
      priority,
      url: `/mascotas/${report.id}`,
    },
  };
}

function getSightingStatusLabel(status) {
  return status === "pending" ? "pendiente de revision" : "visible";
}

export function getNearbySightingNotification({ report, sighting }) {
  const type = notificationTypes.nearbySighting;
  const body = report.zone
    ? `Alguien reportó haberla visto cerca de ${report.zone}.`
    : "Alguien reportó haber visto a tu mascota.";

  return {
    type,
    dedupeKey: getNotificationDedupeKey(type, {
      reportId: report.id,
      sightingId: sighting.id,
    }),
    title: `Posible avistamiento de ${report.pet_name}`,
    body,
    data: {
      reportId: report.id,
      sightingId: sighting.id,
      petName: report.pet_name,
      zone: report.zone ?? null,
      lat: sighting.lat,
      lng: sighting.lng,
      status: sighting.status,
      statusLabel: getSightingStatusLabel(sighting.status),
      seenAt: sighting.seen_at,
      createdAt: sighting.created_at,
      url: `/mascotas/${report.id}#avistamiento`,
    },
  };
}
