import { db } from "../db.js";
import {
  createLoggedMobilePushNotification,
  createLoggedNotification,
  createLoggedWebPushNotification,
  createSkippedNotificationLog,
} from "./notifications.js";
import { reverseGeocode } from "./geocoding.js";
import { getNotificationPreferences } from "./notification-preferences.js";
import { notificationChannels, notificationTypes } from "./notification-rules.js";
import { getCentroid, getDistanceMeters } from "../utils/geo-distance.js";

const digestWindowMinutes = 5;
const digestProcessorIntervalMs = 60 * 1000;
const digestProcessorBatchSize = 20;
const digestClusterRadiusMeters = 350;
const immediateNormalSightingAllowance = 2;
const highActivityThreshold = 12;
const highActivityWindowMinutes = 10;
const highActivityCooldownMinutes = 12;
let digestProcessorTimer = null;
let digestProcessorRunning = false;

function floorToDigestWindow(value) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return floorToDigestWindow(new Date());
  }

  const windowMs = digestWindowMinutes * 60 * 1000;
  return new Date(Math.floor(date.getTime() / windowMs) * windowMs);
}

export function getSightingDigestWindow(value) {
  const windowStart = floorToDigestWindow(value);
  const windowEnd = new Date(windowStart.getTime() + digestWindowMinutes * 60 * 1000);

  return {
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  };
}

export async function enqueueSightingDigest({
  reportId,
  sighting,
  reason = "normal_trust_digest",
  client = db,
}) {
  const { windowStart, windowEnd } = getSightingDigestWindow(sighting.created_at ?? sighting.createdAt);
  const digestResult = await client.query(
    `
      INSERT INTO public.sighting_digest_queue (
        report_id,
        window_start,
        window_end,
        first_sighting_id,
        last_sighting_id,
        sighting_count,
        status,
        reason
      )
      VALUES ($1, $2, $3, $4, $4, 1, 'pending', $5)
      ON CONFLICT (report_id, window_start) DO UPDATE
      SET
        window_end = EXCLUDED.window_end,
        last_sighting_id = EXCLUDED.last_sighting_id,
        status = CASE
          WHEN public.sighting_digest_queue.status = 'pending' THEN 'pending'
          ELSE public.sighting_digest_queue.status
        END,
        reason = EXCLUDED.reason
      RETURNING *
    `,
    [reportId, windowStart, windowEnd, sighting.id, reason],
  );
  const digest = digestResult.rows[0];
  const itemResult = await client.query(
    `
      INSERT INTO public.sighting_digest_items (
        digest_id,
        sighting_id
      )
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      RETURNING sighting_id
    `,
    [digest.id, sighting.id],
  );

  if (itemResult.rows.length > 0) {
    await client.query(
      `
        UPDATE public.sighting_digest_queue
        SET
          sighting_count = (
            SELECT count(*)::integer
            FROM public.sighting_digest_items
            WHERE digest_id = $1
          ),
          first_sighting_id = COALESCE(first_sighting_id, $2),
          last_sighting_id = $2
        WHERE id = $1
      `,
      [digest.id, sighting.id],
    );
  }

  return {
    queued: true,
    digest,
    itemCreated: itemResult.rows.length > 0,
  };
}

export async function countNormalSightingsInDigestWindow({
  reportId,
  createdAt,
  client = db,
}) {
  const { windowStart, windowEnd } = getSightingDigestWindow(createdAt);
  const result = await client.query(
    `
      SELECT count(*)::integer AS count
      FROM public.sightings
      WHERE report_id = $1
        AND created_at >= $2
        AND created_at < $3
        AND status IN ('visible', 'pending')
        AND trust_score < 80
    `,
    [reportId, windowStart, windowEnd],
  );

  return {
    count: Number(result.rows[0]?.count ?? 0),
    windowStart,
    windowEnd,
    immediateAllowance: immediateNormalSightingAllowance,
  };
}

function createDigestDedupeKey(digest) {
  return `nearby_sighting_digest:${digest.report_id}:${new Date(digest.window_start).toISOString()}`;
}

function createHighActivityDedupeKey({ reportId, referenceTime }) {
  const date = referenceTime ? new Date(referenceTime) : new Date();
  const bucketMs = highActivityCooldownMinutes * 60 * 1000;
  const bucketStart = new Date(Math.floor(date.getTime() / bucketMs) * bucketMs);

  return `nearby_sighting_high_activity:${reportId}:${bucketStart.toISOString()}`;
}

function getMainSightingCluster(sightings) {
  const clusters = [];

  for (const sighting of sightings) {
    const point = {
      ...sighting,
      lat: Number(sighting.lat),
      lng: Number(sighting.lng),
    };
    let matchedCluster = null;

    for (const cluster of clusters) {
      if (getDistanceMeters(cluster.centroid, point) <= digestClusterRadiusMeters) {
        matchedCluster = cluster;
        break;
      }
    }

    if (matchedCluster) {
      matchedCluster.points.push(point);
      matchedCluster.centroid = getCentroid(matchedCluster.points);
    } else {
      clusters.push({
        centroid: { lat: point.lat, lng: point.lng },
        points: [point],
      });
    }
  }

  return clusters
    .sort((a, b) => b.points.length - a.points.length)[0] ?? null;
}

function pickDigestZoneLabel(geocodingResult) {
  return geocodingResult?.neighborhood
    || geocodingResult?.municipality
    || geocodingResult?.city
    || geocodingResult?.state
    || null;
}

async function resolveDigestZone({ sightings }) {
  const cluster = getMainSightingCluster(sightings);

  if (!cluster) {
    return null;
  }

  try {
    const geocodingResult = await reverseGeocode(cluster.centroid);
    const zoneLabel = pickDigestZoneLabel(geocodingResult);

    return {
      zoneLabel,
      lat: cluster.centroid.lat,
      lng: cluster.centroid.lng,
      count: cluster.points.length,
      geocoding: {
        source: geocodingResult.source,
        cached: geocodingResult.cached,
        fallbackReason: geocodingResult.fallbackReason ?? null,
      },
    };
  } catch (error) {
    return {
      zoneLabel: null,
      lat: cluster.centroid.lat,
      lng: cluster.centroid.lng,
      count: cluster.points.length,
      geocoding: {
        source: null,
        cached: false,
        error: error.message,
      },
    };
  }
}

function createDigestCopy({ report, count, zoneLabel }) {
  const displayZone = zoneLabel || report.zone || null;

  if (count === 1) {
    return {
      title: `1 avistamiento más de ${report.pet_name}`,
      body: displayZone
        ? `Tambien la reportaron cerca de ${displayZone}.`
        : "Hay otro posible avistamiento reciente.",
    };
  }

  return {
    title: `${count} avistamientos más de ${report.pet_name}`,
    body: displayZone
      ? `Los adicionales la ubican cerca de ${displayZone}.`
      : "Hay más posibles avistamientos recientes.",
  };
}

function createHighActivityCopy({ report, count, zoneLabel }) {
  const displayZone = zoneLabel || report.zone || null;

  return {
    title: `Alta actividad en el reporte de ${report.pet_name}`,
    body: displayZone
      ? `${count} avistamientos recientes la ubican cerca de ${displayZone}.`
      : `${count} avistamientos recientes pueden ayudar a ubicarla.`,
  };
}

async function markDigest({ id, status, failureReason = null, client }) {
  await client.query(
    `
      UPDATE public.sighting_digest_queue
      SET
        status = $2,
        reason = COALESCE($3, reason),
        processed_at = CASE WHEN $2 IN ('processed', 'skipped') THEN now() ELSE processed_at END
      WHERE id = $1
    `,
    [id, status, failureReason],
  );
}

async function processDigestRow({ digest, client }) {
  const reportResult = await client.query(
    `
      SELECT id, profile_id, pet_name, zone
      FROM public.pet_reports
      WHERE id = $1
        AND status = 'active'
      LIMIT 1
    `,
    [digest.report_id],
  );
  const report = reportResult.rows[0];

  if (!report) {
    await markDigest({
      id: digest.id,
      status: "skipped",
      failureReason: "report_not_active",
      client,
    });
    return { status: "skipped", reason: "report_not_active" };
  }

  const preferences = await getNotificationPreferences({
    profileId: report.profile_id,
    client,
  });
  const dedupeKey = createDigestDedupeKey(digest);

  if (!preferences.notifySightingUpdates) {
    await createSkippedNotificationLog({
      profileId: report.profile_id,
      reportId: report.id,
      sightingId: digest.last_sighting_id,
      type: notificationTypes.nearbySighting,
      channel: notificationChannels.inApp,
      dedupeKey,
      reason: "sighting_updates_disabled",
      client,
    });
    await markDigest({
      id: digest.id,
      status: "skipped",
      failureReason: "sighting_updates_disabled",
      client,
    });
    return { status: "skipped", reason: "sighting_updates_disabled" };
  }

  const highActivityResult = await processHighActivityIfNeeded({
    digest,
    report,
    client,
  });

  if (highActivityResult.active) {
    await markDigest({
      id: digest.id,
      status: "skipped",
      failureReason: highActivityResult.reason,
      client,
    });
    return highActivityResult;
  }

  const sightingsResult = await client.query(
    `
      SELECT
        s.id,
        s.lat,
        s.lng,
        s.created_at
      FROM public.sighting_digest_items sdi
      JOIN public.sightings s ON s.id = sdi.sighting_id
      WHERE sdi.digest_id = $1
        AND s.status IN ('visible', 'pending')
      ORDER BY s.created_at ASC
    `,
    [digest.id],
  );
  const sightings = sightingsResult.rows;
  const count = sightings.length;

  if (count === 0) {
    await markDigest({
      id: digest.id,
      status: "skipped",
      failureReason: "empty_digest_window",
      client,
    });
    return { status: "skipped", reason: "empty_digest_window" };
  }

  const digestZone = await resolveDigestZone({ sightings });
  const copy = createDigestCopy({
    report,
    count,
    zoneLabel: digestZone?.zoneLabel,
  });
  const lastSightingId = sightings.at(-1)?.id ?? digest.last_sighting_id;
  const data = {
    reportId: report.id,
    sightingId: lastSightingId,
    sightingCount: count,
    zone: digestZone?.zoneLabel ?? report.zone ?? null,
    reportZone: report.zone ?? null,
    lat: digestZone?.lat ?? null,
    lng: digestZone?.lng ?? null,
    mainClusterCount: digestZone?.count ?? count,
    geocoding: digestZone?.geocoding ?? null,
    windowStart: digest.window_start,
    windowEnd: digest.window_end,
    url: `/mascotas/${report.id}#avistamiento`,
  };

  const inApp = await createLoggedNotification({
    profileId: report.profile_id,
    reportId: report.id,
    sightingId: lastSightingId,
    type: notificationTypes.nearbySighting,
    title: copy.title,
    body: copy.body,
    data,
    channel: notificationChannels.inApp,
    dedupeKey,
    client,
  });
  const webPush = await createLoggedWebPushNotification({
    profileId: report.profile_id,
    reportId: report.id,
    sightingId: lastSightingId,
    type: notificationTypes.nearbySighting,
    title: copy.title,
    body: copy.body,
    data,
    dedupeKey,
    client,
  });
  const mobilePush = await createLoggedMobilePushNotification({
    profileId: report.profile_id,
    reportId: report.id,
    sightingId: lastSightingId,
    type: notificationTypes.nearbySighting,
    title: copy.title,
    body: copy.body,
    data,
    dedupeKey,
    client,
  });

  await markDigest({
    id: digest.id,
    status: "processed",
    client,
  });

  return {
    status: "processed",
    inApp,
    webPush,
    mobilePush,
  };
}

async function getRecentNormalSightings({ reportId, referenceTime, client }) {
  const result = await client.query(
    `
      SELECT
        id,
        lat,
        lng,
        created_at
      FROM public.sightings
      WHERE report_id = $1
        AND created_at > ($2::timestamptz - ($3::text || ' minutes')::interval)
        AND created_at <= $2::timestamptz
        AND status IN ('visible', 'pending')
        AND trust_score < 80
      ORDER BY created_at ASC
    `,
    [reportId, referenceTime, highActivityWindowMinutes],
  );

  return result.rows;
}

async function processHighActivityIfNeeded({ digest, report, client }) {
  const sightings = await getRecentNormalSightings({
    reportId: report.id,
    referenceTime: digest.window_end,
    client,
  });
  const count = sightings.length;

  if (count < highActivityThreshold) {
    return {
      active: false,
    };
  }

  const digestZone = await resolveDigestZone({ sightings });
  const copy = createHighActivityCopy({
    report,
    count,
    zoneLabel: digestZone?.zoneLabel,
  });
  const lastSightingId = sightings.at(-1)?.id ?? digest.last_sighting_id;
  const dedupeKey = createHighActivityDedupeKey({
    reportId: report.id,
    referenceTime: digest.window_end,
  });
  const data = {
    reportId: report.id,
    sightingId: lastSightingId,
    sightingCount: count,
    activityMode: "high_activity",
    activityWindowMinutes: highActivityWindowMinutes,
    cooldownMinutes: highActivityCooldownMinutes,
    zone: digestZone?.zoneLabel ?? report.zone ?? null,
    reportZone: report.zone ?? null,
    lat: digestZone?.lat ?? null,
    lng: digestZone?.lng ?? null,
    mainClusterCount: digestZone?.count ?? count,
    geocoding: digestZone?.geocoding ?? null,
    windowStart: new Date(new Date(digest.window_end).getTime() - highActivityWindowMinutes * 60 * 1000).toISOString(),
    windowEnd: digest.window_end,
    url: `/mascotas/${report.id}#avistamiento`,
  };

  const inApp = await createLoggedNotification({
    profileId: report.profile_id,
    reportId: report.id,
    sightingId: lastSightingId,
    type: notificationTypes.nearbySighting,
    title: copy.title,
    body: copy.body,
    data,
    channel: notificationChannels.inApp,
    dedupeKey,
    client,
  });
  const webPush = await createLoggedWebPushNotification({
    profileId: report.profile_id,
    reportId: report.id,
    sightingId: lastSightingId,
    type: notificationTypes.nearbySighting,
    title: copy.title,
    body: copy.body,
    data,
    dedupeKey,
    client,
  });
  const mobilePush = await createLoggedMobilePushNotification({
    profileId: report.profile_id,
    reportId: report.id,
    sightingId: lastSightingId,
    type: notificationTypes.nearbySighting,
    title: copy.title,
    body: copy.body,
    data,
    dedupeKey,
    client,
  });
  const duplicate = !inApp.created && !webPush.created && !mobilePush.created;

  return {
    active: true,
    status: duplicate ? "skipped" : "processed",
    reason: duplicate ? "high_activity_cooldown" : "high_activity_processed",
    inApp,
    webPush,
    mobilePush,
  };
}

export async function processDueSightingDigests({
  limit = digestProcessorBatchSize,
  client = null,
} = {}) {
  const connection = client ?? await db.connect();
  const ownsConnection = !client;

  try {
    if (ownsConnection) {
      await connection.query("BEGIN");
    }

    const dueResult = await connection.query(
      `
        SELECT *
        FROM public.sighting_digest_queue
        WHERE status = 'pending'
          AND window_end <= now()
        ORDER BY window_end ASC, created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      `,
      [limit],
    );
    const results = [];

    for (const digest of dueResult.rows) {
      try {
        results.push(await processDigestRow({ digest, client: connection }));
      } catch (error) {
        await markDigest({
          id: digest.id,
          status: "failed",
          failureReason: error.message,
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

export function startSightingDigestProcessor({
  intervalMs = digestProcessorIntervalMs,
  enabled = process.env.SIGHTING_DIGEST_PROCESSOR_ENABLED !== "false",
} = {}) {
  if (!enabled || digestProcessorTimer) {
    return null;
  }

  const runProcessor = async () => {
    if (digestProcessorRunning) {
      return;
    }

    digestProcessorRunning = true;

    try {
      await processDueSightingDigests();
    } catch (error) {
      console.error("No se pudieron procesar digest de avistamientos", {
        error: error.message,
      });
    } finally {
      digestProcessorRunning = false;
    }
  };

  digestProcessorTimer = setInterval(runProcessor, intervalMs);
  digestProcessorTimer.unref?.();
  runProcessor();

  return digestProcessorTimer;
}
