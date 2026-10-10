import { db } from "../db.js";
import { getMapClusterCellSize, getMapResponseMode } from "./map-clustering.js";
import { mapReportRow, publicReportColumns } from "./report-mapper.js";

export const reportMapSelect = `
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

async function getMapClusters({ bbox, status, mapResponseMode }) {
  const cellSize = getMapClusterCellSize(mapResponseMode.clusterSize);
  const result = await db.query(`
    WITH visible_reports AS (
      SELECT
        r.last_seen_lat,
        r.last_seen_lng,
        floor((r.last_seen_lng + 180) / $6)::integer AS cell_x,
        floor((r.last_seen_lat + 90) / $6)::integer AS cell_y
      FROM public.pet_reports r
      WHERE r.status = $1
        AND r.last_seen_lat IS NOT NULL
        AND r.last_seen_lng IS NOT NULL
        AND r.last_seen_lat BETWEEN $2 AND $3
        AND r.last_seen_lng BETWEEN $4 AND $5
    )
    SELECT
      count(*)::integer AS count,
      avg(last_seen_lat)::float AS lat,
      avg(last_seen_lng)::float AS lng,
      (cell_x * $6 - 180)::float AS west,
      (cell_y * $6 - 90)::float AS south,
      ((cell_x + 1) * $6 - 180)::float AS east,
      ((cell_y + 1) * $6 - 90)::float AS north
    FROM visible_reports
    GROUP BY cell_x, cell_y
    ORDER BY count DESC
  `, [status, bbox.south, bbox.north, bbox.west, bbox.east, cellSize]);

  return {
    ok: true,
    mode: mapResponseMode.mode,
    clusterSize: mapResponseMode.clusterSize,
    items: result.rows.map((row) => ({
      type: "cluster",
      count: row.count,
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

async function getMapVisibleReports({ bbox, status, mapResponseMode }) {
  const result = await db.query(`
    ${reportMapSelect}
    WHERE r.status = $1
      AND r.last_seen_lat IS NOT NULL
      AND r.last_seen_lng IS NOT NULL
      AND r.last_seen_lat BETWEEN $2 AND $3
      AND r.last_seen_lng BETWEEN $4 AND $5
    ORDER BY r.created_at DESC
  `, [status, bbox.south, bbox.north, bbox.west, bbox.east]);

  return {
    ok: true,
    mode: mapResponseMode.mode,
    clusterSize: mapResponseMode.clusterSize,
    items: result.rows.map((row) => ({
      type: "report",
      ...mapReportRow(row),
    })),
  };
}

export async function getMapReports({ bbox, zoom, status }) {
  const reportMapZoomThresholds = {
    giant: 6,
    large: 10,
    medium: 13,
  };
  const genericMapResponseMode = getMapResponseMode(zoom,reportMapZoomThresholds);
  const mapResponseMode = {
    ...genericMapResponseMode,
    mode: genericMapResponseMode.mode === "items" ? "reports" : genericMapResponseMode.mode,
  };

  if (mapResponseMode.mode === "clusters") {
    return getMapClusters({ bbox, status, mapResponseMode });
  }

  return getMapVisibleReports({ bbox, status, mapResponseMode });
}
