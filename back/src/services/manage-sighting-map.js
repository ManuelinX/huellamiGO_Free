import { db } from "../db.js";
import { getMapClusterCellSize, getMapResponseMode } from "./map-clustering.js";
import { mapSightingRow } from "./report-mapper.js";

const managedMapSightingStatuses = ["visible", "pending", "hidden"];
const denseSightingCellMinCount = 3;
const managedSightingDenseZoom = 14;

function getDenseSightingCellSize(zoom) {
  if (zoom >= 17) {
    return 0.00045;
  }

  if (zoom >= 16) {
    return 0.0007;
  }

  if (zoom >= 15) {
    return 0.0011;
  }

  return 0.0018;
}

async function getManagedSightingClusters({ reportId, bbox, mapResponseMode }) {
  const cellSize = getMapClusterCellSize(mapResponseMode.clusterSize);
  const result = await db.query(`
    WITH visible_sightings AS (
      SELECT
        s.lat,
        s.lng,
        s.status,
        s.is_useful,
        s.is_trail_key,
        floor((s.lng + 180) / $7)::integer AS cell_x,
        floor((s.lat + 90) / $7)::integer AS cell_y
      FROM public.sightings s
      WHERE s.report_id = $1
        AND s.status = ANY($2)
        AND s.lat IS NOT NULL
        AND s.lng IS NOT NULL
        AND s.lat BETWEEN $3 AND $4
        AND s.lng BETWEEN $5 AND $6
    )
    SELECT
      count(*)::integer AS count,
      count(*) FILTER (WHERE is_useful = true)::integer AS useful_count,
      count(*) FILTER (WHERE is_trail_key = true)::integer AS trail_key_count,
      count(*) FILTER (WHERE status = 'hidden')::integer AS hidden_count,
      count(*) FILTER (WHERE status = 'pending')::integer AS pending_count,
      avg(lat)::float AS lat,
      avg(lng)::float AS lng,
      (cell_x * $7 - 180)::float AS west,
      (cell_y * $7 - 90)::float AS south,
      ((cell_x + 1) * $7 - 180)::float AS east,
      ((cell_y + 1) * $7 - 90)::float AS north
    FROM visible_sightings
    GROUP BY cell_x, cell_y
    ORDER BY count DESC
  `, [
    reportId,
    managedMapSightingStatuses,
    bbox.south,
    bbox.north,
    bbox.west,
    bbox.east,
    cellSize,
  ]);

  return {
    ok: true,
    mode: "clusters",
    clusterSize: mapResponseMode.clusterSize,
    items: result.rows.map((row) => ({
      type: "cluster",
      count: row.count,
      usefulCount: row.useful_count,
      trailKeyCount: row.trail_key_count,
      hiddenCount: row.hidden_count,
      pendingCount: row.pending_count,
      coordinates: [row.lat, row.lng],
      bounds: {
        west: row.west,
        south: row.south,
        east: row.east,
        north: row.north,
      },
    })),
  };
}

async function getManagedMapSightings({ reportId, bbox, mapResponseMode }) {
  const result = await db.query(`
    SELECT
      s.*,
      p.public_url AS photo_url
    FROM public.sightings s
    LEFT JOIN public.pet_photos p ON p.id = s.photo_id
    WHERE s.report_id = $1
      AND s.status = ANY($2)
      AND s.lat IS NOT NULL
      AND s.lng IS NOT NULL
      AND s.lat BETWEEN $3 AND $4
      AND s.lng BETWEEN $5 AND $6
    ORDER BY s.created_at DESC
  `, [
    reportId,
    managedMapSightingStatuses,
    bbox.south,
    bbox.north,
    bbox.west,
    bbox.east,
  ]);

  return {
    ok: true,
    mode: "sightings",
    clusterSize: mapResponseMode.clusterSize,
    items: result.rows.map((row) => ({
      type: "sighting",
      ...mapSightingRow(row),
    })),
  };
}

async function getManagedSightingDensityMap({ reportId, bbox, zoom }) {
  const cellSize = getDenseSightingCellSize(zoom);
  const clusterResult = await db.query(`
    WITH positioned_sightings AS (
      SELECT
        s.lat,
        s.lng,
        s.status,
        s.is_useful,
        s.is_trail_key,
        floor((s.lng + 180) / $7)::integer AS cell_x,
        floor((s.lat + 90) / $7)::integer AS cell_y
      FROM public.sightings s
      WHERE s.report_id = $1
        AND s.status = ANY($2)
        AND s.lat IS NOT NULL
        AND s.lng IS NOT NULL
        AND s.lat BETWEEN $3 AND $4
        AND s.lng BETWEEN $5 AND $6
    )
    SELECT
      cell_x,
      cell_y,
      count(*)::integer AS count,
      count(*) FILTER (WHERE is_useful = true)::integer AS useful_count,
      count(*) FILTER (WHERE is_trail_key = true)::integer AS trail_key_count,
      count(*) FILTER (WHERE status = 'hidden')::integer AS hidden_count,
      count(*) FILTER (WHERE status = 'pending')::integer AS pending_count,
      avg(lat)::float AS lat,
      avg(lng)::float AS lng,
      (cell_x * $7 - 180)::float AS west,
      (cell_y * $7 - 90)::float AS south,
      ((cell_x + 1) * $7 - 180)::float AS east,
      ((cell_y + 1) * $7 - 90)::float AS north
    FROM positioned_sightings
    GROUP BY cell_x, cell_y
    HAVING count(*) >= $8
    ORDER BY count DESC
  `, [
    reportId,
    managedMapSightingStatuses,
    bbox.south,
    bbox.north,
    bbox.west,
    bbox.east,
    cellSize,
    denseSightingCellMinCount,
  ]);
  const sightingsResult = await db.query(`
    WITH positioned_sightings AS (
      SELECT
        s.*,
        p.public_url AS photo_url,
        floor((s.lng + 180) / $7)::integer AS cell_x,
        floor((s.lat + 90) / $7)::integer AS cell_y
      FROM public.sightings s
      LEFT JOIN public.pet_photos p ON p.id = s.photo_id
      WHERE s.report_id = $1
        AND s.status = ANY($2)
        AND s.lat IS NOT NULL
        AND s.lng IS NOT NULL
        AND s.lat BETWEEN $3 AND $4
        AND s.lng BETWEEN $5 AND $6
    ),
    dense_cells AS (
      SELECT cell_x, cell_y
      FROM positioned_sightings
      GROUP BY cell_x, cell_y
      HAVING count(*) >= $8
    )
    SELECT positioned_sightings.*
    FROM positioned_sightings
    WHERE NOT EXISTS (
      SELECT 1
      FROM dense_cells
      WHERE dense_cells.cell_x = positioned_sightings.cell_x
        AND dense_cells.cell_y = positioned_sightings.cell_y
    )
    ORDER BY positioned_sightings.created_at DESC
  `, [
    reportId,
    managedMapSightingStatuses,
    bbox.south,
    bbox.north,
    bbox.west,
    bbox.east,
    cellSize,
    denseSightingCellMinCount,
  ]);

  return {
    ok: true,
    mode: "density",
    clusterSize: "dense",
    items: [
      ...clusterResult.rows.map((row) => ({
        type: "cluster",
        count: row.count,
        usefulCount: row.useful_count,
        trailKeyCount: row.trail_key_count,
        hiddenCount: row.hidden_count,
        pendingCount: row.pending_count,
        coordinates: [row.lat, row.lng],
        bounds: {
          west: row.west,
          south: row.south,
          east: row.east,
          north: row.north,
        },
      })),
      ...sightingsResult.rows.map((row) => ({
        type: "sighting",
        ...mapSightingRow(row),
      })),
    ],
  };
}

export async function getManagedSightingMap({ reportId, bbox, zoom }) {
  const managedSightingMapZoomThresholds = {
    giant: 8,
    large: 11,
    medium: 13,
  };
  const mapResponseMode = getMapResponseMode(zoom, managedSightingMapZoomThresholds);

  if (mapResponseMode.mode === "clusters") {
    return getManagedSightingClusters({ reportId, bbox, mapResponseMode });
  }

  if (zoom >= managedSightingDenseZoom) {
    return getManagedSightingDensityMap({ reportId, bbox, zoom });
  }

  return getManagedMapSightings({ reportId, bbox, mapResponseMode });
}
