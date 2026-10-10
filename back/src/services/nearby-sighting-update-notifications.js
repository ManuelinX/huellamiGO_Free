import { nearbySightingUpdateConfig as defaultConfig } from "../config/nearby-sighting-updates.js";
import { db } from "../db.js";
import { getCentroid, getDistanceMeters } from "../utils/geo-distance.js";
import {
  createLoggedMobilePushNotification,
  createLoggedNotification,
  createLoggedWebPushNotification,
} from "./notifications.js";
import {
  notificationChannels,
  notificationTypes,
} from "./notification-rules.js";
import { getPostgisSqlNames } from "./postgis.js";

let nearbySightingUpdateProcessorTimer = null;
let nearbySightingUpdateProcessorRunning = false;

function floorToWindow(value, windowMinutes) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return floorToWindow(new Date(), windowMinutes);
  }

  const windowMs = windowMinutes * 60 * 1000;
  return new Date(Math.floor(date.getTime() / windowMs) * windowMs);
}

export function getNearbySightingUpdateWindow(value, config = defaultConfig) {
  const windowStart = floorToWindow(value, config.windowMinutes);
  const windowEnd = new Date(windowStart.getTime() + config.windowMinutes * 60 * 1000);

  return {
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  };
}

export function createNearbySightingUpdateDedupeKey({
  reportId,
  date = new Date(),
}) {
  const day = new Date(date).toISOString().slice(0, 10);

  return `nearby_sighting_update:${reportId}:${day}`;
}

export async function enqueueNearbySightingUpdateWindow({
  reportId,
  sighting,
  client = db,
  config = defaultConfig,
}) {
  if (!config.enabled) {
    return {
      queued: false,
      reason: "nearby_sighting_update_disabled",
    };
  }

  const { windowStart, windowEnd } = getNearbySightingUpdateWindow(
    sighting.created_at ?? sighting.createdAt,
    config,
  );
  const result = await client.query(
    `
      INSERT INTO public.nearby_sighting_update_queue (
        report_id,
        window_start,
        window_end,
        status,
        reason
      )
      VALUES ($1, $2, $3, 'pending', 'sighting_created')
      ON CONFLICT (report_id, window_start) DO UPDATE
      SET
        window_end = EXCLUDED.window_end,
        status = CASE
          WHEN public.nearby_sighting_update_queue.status = 'pending' THEN 'pending'
          ELSE public.nearby_sighting_update_queue.status
        END,
        reason = EXCLUDED.reason
      RETURNING *
    `,
    [reportId, windowStart, windowEnd],
  );

  return {
    queued: true,
    updateWindow: result.rows[0],
  };
}

function normalizePoint(row) {
  return {
    ...row,
    lat: Number(row.lat),
    lng: Number(row.lng),
    trust_score: Number(row.trust_score ?? 40),
  };
}

function buildSightingClusters(sightings, config) {
  const clusters = [];

  for (const row of sightings) {
    const sighting = normalizePoint(row);
    let matchedCluster = null;

    for (const cluster of clusters) {
      if (getDistanceMeters(cluster.centroid, sighting) <= config.clusterRadiusMeters) {
        matchedCluster = cluster;
        break;
      }
    }

    if (matchedCluster) {
      matchedCluster.sightings.push(sighting);
      matchedCluster.centroid = getCentroid(matchedCluster.sightings);
    } else {
      clusters.push({
        centroid: { lat: sighting.lat, lng: sighting.lng },
        sightings: [sighting],
      });
    }
  }

  return clusters
    .map((cluster) => addClusterStats(cluster, config))
    .sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }

      return b.sightings.length - a.sightings.length;
    });
}

function getSubmitterKey(sighting) {
  return sighting.profile_id
    ? `profile:${sighting.profile_id}`
    : `ip:${sighting.created_ip ?? "unknown"}`;
}

function getWeightedSubmitterCount(sightings, config) {
  const counts = new Map();
  let total = 0;

  for (const sighting of sightings) {
    const key = getSubmitterKey(sighting);
    const seen = counts.get(key) ?? 0;
    const weight = config.sameUserWeights[seen] ?? 0;

    total += weight;
    counts.set(key, seen + 1);
  }

  return total;
}

function getClusterDispersion(cluster) {
  if (cluster.sightings.length === 0) {
    return {
      averageMeters: 0,
      maxMeters: 0,
    };
  }

  const distances = cluster.sightings.map((sighting) => getDistanceMeters(cluster.centroid, sighting));
  const total = distances.reduce((sum, distance) => sum + distance, 0);

  return {
    averageMeters: total / distances.length,
    maxMeters: Math.max(...distances),
  };
}

function addClusterStats(cluster, config) {
  const sightings = cluster.sightings;
  const count = sightings.length;
  const weightedSubmitterCount = getWeightedSubmitterCount(sightings, config);
  const trustAverage = sightings.reduce(
    (sum, sighting) => sum + Number(sighting.trust_score ?? 40),
    0,
  ) / count;
  const sourceTypes = new Set(sightings.map((sighting) => sighting.source_type));
  const hasTrustedSource = ["verified_business", "rescuer", "trusted"]
    .some((sourceType) => sourceTypes.has(sourceType));
  const hasPhoto = sightings.some((sighting) => sighting.photo_id || sighting.photo_url);
  const submitterKeys = new Set(sightings.map(getSubmitterKey));
  const ipKeys = new Set(sightings
    .filter((sighting) => sighting.created_ip)
    .map((sighting) => sighting.created_ip));
  const dispersion = getClusterDispersion(cluster);
  const reasons = [];
  let score = 0;

  if (weightedSubmitterCount >= 3) {
    score += 45;
    reasons.push("weighted_count_3");
  } else if (weightedSubmitterCount >= 2) {
    score += 30;
    reasons.push("weighted_count_2");
  }

  if (trustAverage >= 80) {
    score += 30;
    reasons.push("trust_average_80");
  } else if (trustAverage >= 60) {
    score += 20;
    reasons.push("trust_average_60");
  } else if (trustAverage >= 40) {
    score += 10;
    reasons.push("trust_average_40");
  }

  if (hasTrustedSource) {
    score += 25;
    reasons.push("trusted_source");
  }

  if (hasPhoto) {
    score += 10;
    reasons.push("has_photo");
  }

  if (submitterKeys.size >= 2) {
    score += 15;
    reasons.push("submitter_diversity");
  }

  if (ipKeys.size === 1 && count > 1) {
    score -= config.sameIpPenalty;
    reasons.push("same_ip_penalty");
  }

  if (dispersion.averageMeters <= config.compactDispersionMeters) {
    score += 15;
    reasons.push("compact_cluster");
  } else if (dispersion.averageMeters <= config.looseDispersionMeters) {
    score += 5;
    reasons.push("loose_cluster");
  } else {
    score -= config.highDispersionPenalty;
    reasons.push("high_dispersion_penalty");
  }

  return {
    ...cluster,
    confidence: Math.max(0, Math.min(100, Math.round(score))),
    trustAverage: Math.round(trustAverage),
    weightedSubmitterCount,
    uniqueSubmitters: submitterKeys.size,
    uniqueIps: ipKeys.size,
    dispersion,
    hasTrustedSource,
    hasPhoto,
    reasons,
  };
}

function getReportPoint(report) {
  return {
    lat: report.last_seen_lat,
    lng: report.last_seen_lng,
  };
}

function getLastSighting(cluster) {
  return cluster.sightings
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .at(-1);
}

async function getReport({ reportId, client }) {
  const result = await client.query(
    `
      SELECT
        id,
        profile_id,
        pet_name,
        status,
        zone,
        last_seen_lat,
        last_seen_lng
      FROM public.pet_reports
      WHERE id = $1
      LIMIT 1
    `,
    [reportId],
  );

  return result.rows[0] ?? null;
}

async function getSightingsForWindow({ reportId, windowStart, windowEnd, client }) {
  const result = await client.query(
    `
      SELECT
        id,
        profile_id,
        lat,
        lng,
        photo_id,
        photo_url,
        created_ip,
        trust_score,
        source_type,
        created_at
      FROM public.sightings
      WHERE report_id = $1
        AND created_at >= $2
        AND created_at < $3
        AND status IN ('visible', 'pending')
      ORDER BY created_at ASC
    `,
    [reportId, windowStart, windowEnd],
  );

  return result.rows;
}

async function getLastNotifiedCluster({ reportId, mode, client }) {
  const result = await client.query(
    `
      SELECT *
      FROM public.report_sighting_update_clusters
      WHERE report_id = $1
        AND mode = $2
      ORDER BY notified_at DESC
      LIMIT 1
    `,
    [reportId, mode],
  );

  return result.rows[0] ?? null;
}

async function hasReportCooldown({ reportId, mode, config, client }) {
  const result = await client.query(
    `
      SELECT id
      FROM public.report_sighting_update_clusters
      WHERE report_id = $1
        AND mode = $2
        AND notified_at > now() - ($3::text || ' hours')::interval
      LIMIT 1
    `,
    [reportId, mode, config.reportCooldownHours],
  );

  return Boolean(result.rows[0]);
}

function createNearbyUpdateCopy({ report }) {
  return {
    title: "Nuevo avistamiento cercano",
    body: `${report.pet_name} fue reportada recientemente cerca de tu zona.`,
  };
}

function buildCandidateDecision({ report, cluster, lastCluster, config }) {
  const reportDistanceMeters = getDistanceMeters(getReportPoint(report), cluster.centroid);
  const lastClusterDistanceMeters = lastCluster
    ? getDistanceMeters(
      { lat: lastCluster.lat, lng: lastCluster.lng },
      cluster.centroid,
    )
    : null;
  const distanceMeters = lastClusterDistanceMeters ?? reportDistanceMeters;
  const lastSighting = getLastSighting(cluster);
  const trustedSingleAllowed = config.trustedSingleSightingEnabled
    && cluster.sightings.length === 1
    && cluster.trustAverage >= config.trustedSingleSightingMinTrustScore
    && reportDistanceMeters >= config.trustedSingleSightingMinDistanceMeters
    && cluster.hasTrustedSource;

  if (report.status && report.status !== "active") {
    return {
      shouldNotify: false,
      reason: "report_not_active",
      reportDistanceMeters,
      lastClusterDistanceMeters,
      clusterConfidence: cluster.confidence,
      clusterCount: cluster.sightings.length,
      distanceMeters,
    };
  }

  if (reportDistanceMeters < config.minDistanceFromReportOriginMeters) {
    return {
      shouldNotify: false,
      reason: "too_close_to_report_origin",
      reportDistanceMeters,
      lastClusterDistanceMeters,
      clusterConfidence: cluster.confidence,
      clusterCount: cluster.sightings.length,
    };
  }

  if (lastCluster && lastClusterDistanceMeters < config.minDistanceFromLastClusterMeters) {
    return {
      shouldNotify: false,
      reason: "too_close_to_last_notified_cluster",
      reportDistanceMeters,
      lastClusterDistanceMeters,
      clusterConfidence: cluster.confidence,
      clusterCount: cluster.sightings.length,
    };
  }

  if (!trustedSingleAllowed && cluster.sightings.length < config.minClusterSightings) {
    return {
      shouldNotify: false,
      reason: "cluster_too_small",
      reportDistanceMeters,
      lastClusterDistanceMeters,
      clusterConfidence: cluster.confidence,
      clusterCount: cluster.sightings.length,
    };
  }

  if (!trustedSingleAllowed && cluster.confidence < config.minClusterConfidence) {
    return {
      shouldNotify: false,
      reason: "cluster_low_confidence",
      reportDistanceMeters,
      lastClusterDistanceMeters,
      clusterConfidence: cluster.confidence,
      clusterCount: cluster.sightings.length,
    };
  }

  return {
    shouldNotify: true,
    reason: trustedSingleAllowed ? "trusted_single_sighting" : "cluster_new_probable_zone",
    reportDistanceMeters,
    lastClusterDistanceMeters,
    clusterConfidence: cluster.confidence,
    clusterCount: cluster.sightings.length,
    distanceMeters,
    trustScore: cluster.trustAverage,
    sourceType: cluster.hasTrustedSource ? "trusted" : lastSighting.source_type,
    radiusKm: config.recipientRadiusKm,
  };
}

async function findNearbyRecipients({ report, cluster, excludedProfileIds, config, client }) {
  const gis = getPostgisSqlNames();
  const result = await client.query(
    `
      SELECT
        np.profile_id,
        ${gis.stDistance}(
          ${gis.stSetSrid}(${gis.stPoint}(np.alert_lng, np.alert_lat), 4326)::${gis.geography},
          ${gis.stSetSrid}(${gis.stPoint}($2, $1), 4326)::${gis.geography}
        ) AS distance_meters
      FROM public.notification_preferences np
      JOIN public.app_users u ON u.id = np.profile_id
      WHERE np.notify_nearby_reports = true
        AND np.alert_lat IS NOT NULL
        AND np.alert_lng IS NOT NULL
        AND u.status = 'active'
        AND NOT (np.profile_id = ANY($3::uuid[]))
        AND ${gis.stDWithin}(
          ${gis.stSetSrid}(${gis.stPoint}(np.alert_lng, np.alert_lat), 4326)::${gis.geography},
          ${gis.stSetSrid}(${gis.stPoint}($2, $1), 4326)::${gis.geography},
          ($4 * 1000)::double precision
        )
      ORDER BY distance_meters ASC
      LIMIT $5
    `,
    [
      cluster.centroid.lat,
      cluster.centroid.lng,
      Array.from(excludedProfileIds),
      config.recipientRadiusKm,
      config.maxRecipients,
    ],
  );

  return result.rows.map((recipient) => ({
    ...recipient,
    report,
  }));
}

async function saveClusterState({
  report,
  cluster,
  decision,
  windowStart,
  windowEnd,
  mode,
  client,
}) {
  const lastSighting = getLastSighting(cluster);

  await client.query(
    `
      INSERT INTO public.report_sighting_update_clusters (
        report_id,
        last_sighting_id,
        mode,
        lat,
        lng,
        confidence,
        sighting_count,
        window_start,
        window_end,
        data
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
    [
      report.id,
      lastSighting?.id ?? null,
      mode,
      cluster.centroid.lat,
      cluster.centroid.lng,
      cluster.confidence,
      cluster.sightings.length,
      windowStart,
      windowEnd,
      {
        decision,
        dispersion: cluster.dispersion,
        trustAverage: cluster.trustAverage,
        weightedSubmitterCount: cluster.weightedSubmitterCount,
        uniqueSubmitters: cluster.uniqueSubmitters,
        uniqueIps: cluster.uniqueIps,
        reasons: cluster.reasons,
      },
    ],
  );
}

async function markUpdateWindow({ id, status, reason, decision = {}, client }) {
  await client.query(
    `
      UPDATE public.nearby_sighting_update_queue
      SET
        status = $2,
        reason = $3,
        decision = $4,
        processed_at = CASE WHEN $2 IN ('processed', 'skipped', 'dry_run') THEN now() ELSE processed_at END
      WHERE id = $1
    `,
    [id, status, reason, decision],
  );
}

async function processNearbySightingUpdateRow({ updateWindow, client, config }) {
  const mode = config.dryRun ? "dry_run" : "sent";
  const report = await getReport({
    reportId: updateWindow.report_id,
    client,
  });

  if (!report || report.status !== "active") {
    await markUpdateWindow({
      id: updateWindow.id,
      status: "skipped",
      reason: "report_not_active",
      decision: { reportFound: Boolean(report) },
      client,
    });
    return { status: "skipped", reason: "report_not_active" };
  }

  if (await hasReportCooldown({ reportId: report.id, mode, config, client })) {
    await markUpdateWindow({
      id: updateWindow.id,
      status: "skipped",
      reason: "report_cooldown",
      decision: { cooldownHours: config.reportCooldownHours, mode },
      client,
    });
    return { status: "skipped", reason: "report_cooldown" };
  }

  const sightings = await getSightingsForWindow({
    reportId: report.id,
    windowStart: updateWindow.window_start,
    windowEnd: updateWindow.window_end,
    client,
  });

  if (sightings.length === 0) {
    await markUpdateWindow({
      id: updateWindow.id,
      status: "skipped",
      reason: "empty_window",
      client,
    });
    return { status: "skipped", reason: "empty_window" };
  }

  const clusters = buildSightingClusters(sightings, config);
  const cluster = clusters[0];
  const lastCluster = await getLastNotifiedCluster({
    reportId: report.id,
    mode,
    client,
  });
  const decision = buildCandidateDecision({
    report,
    cluster,
    lastCluster,
    config,
  });
  const decisionData = {
    ...decision,
    dryRun: config.dryRun,
    cluster: {
      lat: cluster.centroid.lat,
      lng: cluster.centroid.lng,
      confidence: cluster.confidence,
      sightingCount: cluster.sightings.length,
      trustAverage: cluster.trustAverage,
      weightedSubmitterCount: cluster.weightedSubmitterCount,
      uniqueSubmitters: cluster.uniqueSubmitters,
      uniqueIps: cluster.uniqueIps,
      dispersion: cluster.dispersion,
      reasons: cluster.reasons,
    },
    windowStart: updateWindow.window_start,
    windowEnd: updateWindow.window_end,
  };

  if (!decision.shouldNotify) {
    await markUpdateWindow({
      id: updateWindow.id,
      status: "skipped",
      reason: decision.reason,
      decision: decisionData,
      client,
    });
    return { status: "skipped", reason: decision.reason, decision: decisionData };
  }

  const actorProfileIds = new Set(cluster.sightings
    .map((sighting) => sighting.profile_id)
    .filter(Boolean));
  const excludedProfileIds = new Set([report.profile_id, ...actorProfileIds]);
  const recipients = await findNearbyRecipients({
    report,
    cluster,
    excludedProfileIds,
    config,
    client,
  });

  if (config.dryRun) {
    await saveClusterState({
      report,
      cluster,
      decision,
      windowStart: updateWindow.window_start,
      windowEnd: updateWindow.window_end,
      mode,
      client,
    });
    await markUpdateWindow({
      id: updateWindow.id,
      status: "dry_run",
      reason: "dry_run_candidate",
      decision: {
        ...decisionData,
        matchedUsers: recipients.length,
      },
      client,
    });
    return {
      status: "dry_run",
      reason: "dry_run_candidate",
      matchedUsers: recipients.length,
      decision: decisionData,
    };
  }

  const copy = createNearbyUpdateCopy({ report });
  const lastSighting = getLastSighting(cluster);
  const notifications = [];
  const pushNotifications = [];

  for (const recipient of recipients) {
    const dedupeKey = createNearbySightingUpdateDedupeKey({
      reportId: report.id,
      date: updateWindow.window_end,
    });
    const data = {
      reportId: report.id,
      sightingId: lastSighting?.id ?? null,
      updateType: "nearby_sighting_update",
      clusterConfidence: cluster.confidence,
      sightingCount: cluster.sightings.length,
      distanceMeters: Math.round(Number(recipient.distance_meters ?? 0)),
      radiusKm: config.recipientRadiusKm,
      url: `/mascotas/${report.id}`,
    };

    notifications.push(await createLoggedNotification({
      profileId: recipient.profile_id,
      reportId: report.id,
      sightingId: lastSighting?.id ?? null,
      type: notificationTypes.nearbySighting,
      title: copy.title,
      body: copy.body,
      data,
      channel: notificationChannels.inApp,
      dedupeKey,
      client,
    }));
    pushNotifications.push(await createLoggedWebPushNotification({
      profileId: recipient.profile_id,
      reportId: report.id,
      sightingId: lastSighting?.id ?? null,
      type: notificationTypes.nearbySighting,
      title: copy.title,
      body: copy.body,
      data,
      dedupeKey,
      client,
    }));
    pushNotifications.push(await createLoggedMobilePushNotification({
      profileId: recipient.profile_id,
      reportId: report.id,
      sightingId: lastSighting?.id ?? null,
      type: notificationTypes.nearbySighting,
      title: copy.title,
      body: copy.body,
      data,
      dedupeKey,
      client,
    }));
  }

  await saveClusterState({
    report,
    cluster,
    decision,
    windowStart: updateWindow.window_start,
    windowEnd: updateWindow.window_end,
    mode,
    client,
  });
  await markUpdateWindow({
    id: updateWindow.id,
    status: "processed",
    reason: "sent",
    decision: {
      ...decisionData,
      matchedUsers: recipients.length,
      createdNotifications: notifications.filter((item) => item.created).length,
      createdPushNotifications: pushNotifications.filter((item) => item.created).length,
    },
    client,
  });

  return {
    status: "processed",
    matchedUsers: recipients.length,
    createdNotifications: notifications.filter((item) => item.created).length,
    createdPushNotifications: pushNotifications.filter((item) => item.created).length,
    decision: decisionData,
  };
}

export async function processDueNearbySightingUpdates({
  limit = defaultConfig.processorBatchSize,
  client = null,
  config = defaultConfig,
} = {}) {
  if (!config.enabled) {
    return {
      processed: 0,
      results: [],
      skippedReason: "nearby_sighting_update_disabled",
    };
  }

  const connection = client ?? await db.connect();
  const ownsConnection = !client;

  try {
    if (ownsConnection) {
      await connection.query("BEGIN");
    }

    const dueResult = await connection.query(
      `
        SELECT *
        FROM public.nearby_sighting_update_queue
        WHERE status = 'pending'
          AND window_end <= now()
        ORDER BY window_end ASC, created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      `,
      [limit],
    );
    const results = [];

    for (const updateWindow of dueResult.rows) {
      try {
        results.push(await processNearbySightingUpdateRow({
          updateWindow,
          client: connection,
          config,
        }));
      } catch (error) {
        await markUpdateWindow({
          id: updateWindow.id,
          status: "failed",
          reason: error.message,
          decision: { error: error.message },
          client: connection,
        });
        results.push({ status: "failed", reason: error.message });
      }
    }

    if (ownsConnection) {
      await connection.query("COMMIT");
    }

    return {
      processed: results.length,
      results,
    };
  } catch (error) {
    if (ownsConnection) {
      await connection.query("ROLLBACK");
    }

    throw error;
  } finally {
    if (ownsConnection) {
      connection.release();
    }
  }
}

export function startNearbySightingUpdateProcessor({
  intervalMs = defaultConfig.processorIntervalMs,
  enabled = defaultConfig.enabled,
  config = defaultConfig,
} = {}) {
  if (!enabled || nearbySightingUpdateProcessorTimer) {
    return null;
  }

  const runProcessor = async () => {
    if (nearbySightingUpdateProcessorRunning) {
      return;
    }

    nearbySightingUpdateProcessorRunning = true;

    try {
      await processDueNearbySightingUpdates({ config });
    } catch (error) {
      console.error("No se pudieron procesar actualizaciones cercanas por avistamiento", {
        error: error.message,
      });
    } finally {
      nearbySightingUpdateProcessorRunning = false;
    }
  };

  nearbySightingUpdateProcessorTimer = setInterval(runProcessor, intervalMs);
  nearbySightingUpdateProcessorTimer.unref?.();
  runProcessor();

  return nearbySightingUpdateProcessorTimer;
}
