import "../config.js";

function readBooleanEnv(name, fallback) {
  const value = process.env[name];

  if (value === undefined) {
    return fallback;
  }

  return value === "true";
}

function readNumberEnv(name, fallback) {
  const value = Number(process.env[name]);

  return Number.isFinite(value) ? value : fallback;
}

export const nearbySightingUpdateConfig = {
  enabled: readBooleanEnv("NEARBY_SIGHTING_UPDATE_ENABLED", false),
  dryRun: readBooleanEnv("NEARBY_SIGHTING_UPDATE_DRY_RUN", true),

  processorIntervalMs: readNumberEnv("NEARBY_SIGHTING_UPDATE_PROCESSOR_INTERVAL_MS", 60 * 1000),
  processorBatchSize: readNumberEnv("NEARBY_SIGHTING_UPDATE_PROCESSOR_BATCH_SIZE", 20),

  windowMinutes: readNumberEnv("NEARBY_SIGHTING_UPDATE_WINDOW_MINUTES", 10),
  clusterRadiusMeters: readNumberEnv("NEARBY_SIGHTING_UPDATE_CLUSTER_RADIUS_METERS", 500),
  minDistanceFromLastClusterMeters: readNumberEnv(
    "NEARBY_SIGHTING_UPDATE_MIN_DISTANCE_FROM_LAST_CLUSTER_METERS",
    700,
  ),
  minDistanceFromReportOriginMeters: readNumberEnv(
    "NEARBY_SIGHTING_UPDATE_MIN_DISTANCE_FROM_REPORT_ORIGIN_METERS",
    1000,
  ),

  minClusterSightings: readNumberEnv("NEARBY_SIGHTING_UPDATE_MIN_CLUSTER_SIGHTINGS", 2),
  minClusterConfidence: readNumberEnv("NEARBY_SIGHTING_UPDATE_MIN_CLUSTER_CONFIDENCE", 70),

  trustedSingleSightingEnabled: readBooleanEnv(
    "NEARBY_SIGHTING_UPDATE_TRUSTED_SINGLE_ENABLED",
    true,
  ),
  trustedSingleSightingMinTrustScore: readNumberEnv(
    "NEARBY_SIGHTING_UPDATE_TRUSTED_SINGLE_MIN_TRUST_SCORE",
    80,
  ),
  trustedSingleSightingMinDistanceMeters: readNumberEnv(
    "NEARBY_SIGHTING_UPDATE_TRUSTED_SINGLE_MIN_DISTANCE_METERS",
    1000,
  ),

  recipientRadiusKm: readNumberEnv("NEARBY_SIGHTING_UPDATE_RECIPIENT_RADIUS_KM", 2),
  reportCooldownHours: readNumberEnv("NEARBY_SIGHTING_UPDATE_REPORT_COOLDOWN_HOURS", 12),
  userDedupeDays: readNumberEnv("NEARBY_SIGHTING_UPDATE_USER_DEDUPE_DAYS", 1),
  maxRecipients: readNumberEnv("NEARBY_SIGHTING_UPDATE_MAX_RECIPIENTS", 500),

  sameUserWeights: [1, 0.35, 0.1, 0],
  sameIpPenalty: readNumberEnv("NEARBY_SIGHTING_UPDATE_SAME_IP_PENALTY", 15),
  compactDispersionMeters: readNumberEnv(
    "NEARBY_SIGHTING_UPDATE_COMPACT_DISPERSION_METERS",
    150,
  ),
  looseDispersionMeters: readNumberEnv(
    "NEARBY_SIGHTING_UPDATE_LOOSE_DISPERSION_METERS",
    300,
  ),
  highDispersionPenalty: readNumberEnv("NEARBY_SIGHTING_UPDATE_HIGH_DISPERSION_PENALTY", 15),
};
