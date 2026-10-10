import { db } from "../db.js";
import { getPostgisSqlNames } from "./postgis.js";

function mapNearbyAlert(row) {
  const alertReasons = [];

  if (row.has_lost_report_match) {
    alertReasons.push("lost_report");
  }

  if (row.has_recent_sighting_match) {
    alertReasons.push("recent_sighting");
  }

  return {
    id: row.id,
    petName: row.pet_name,
    petType: row.pet_type,
    description: row.description,
    zone: row.zone,
    lastSeenPlace: row.last_seen_place,
    lastSeenLat: row.last_seen_lat,
    lastSeenLng: row.last_seen_lng,
    photoUrl: row.photo_url,
    status: row.status,
    createdAt: row.created_at,
    distanceMeters: Math.round(Number(row.distance_meters ?? 0)),
    alertReasons,
    latestSightingAt: row.latest_sighting_at,
    nearbySightingsCount: Number(row.nearby_sightings_count ?? 0)
  };
}

export async function findNearbyAlerts({
  lat,
  lng,
  radiusKm,
  recentHours,
  limit
}) {
  const gis = getPostgisSqlNames();

  const query = `
    with params as (
      select
        $1::double precision as user_lat,
        $2::double precision as user_lng,
        ($3::double precision * 1000)::double precision as radius_meters,
        now() - ($4::double precision * interval '1 hour') as recent_since,
        $5::integer as max_results
    ),
    user_location as (
      select
        ${gis.stSetSrid}(${gis.stPoint}(user_lng, user_lat), 4326)::${gis.geography} as geog,
        radius_meters,
        recent_since,
        max_results
      from params
    ),
    lost_report_matches as (
      select
        r.id,
        r.created_at,
        r.pet_name,
        r.pet_type,
        r.description,
        r.zone,
        r.last_seen_place,
        r.last_seen_lat,
        r.last_seen_lng,
        p.public_url as photo_url,
        r.status,
        ${gis.stDistance}(
          ${gis.stSetSrid}(${gis.stPoint}(r.last_seen_lng, r.last_seen_lat), 4326)::${gis.geography},
          u.geog
        ) as distance_meters,
        true as has_lost_report_match,
        false as has_recent_sighting_match,
        null::timestamptz as latest_sighting_at,
        0::integer as nearby_sightings_count
      from public.pet_reports r
      left join lateral (
        select public_url
        from public.pet_photos
        where report_id = r.id
          and photo_type = 'report'
        order by is_primary desc, created_at desc
        limit 1
      ) p on true
      cross join user_location u
      where r.status = 'active'
        and r.last_seen_lat is not null
        and r.last_seen_lng is not null
        and ${gis.stDWithin}(
          ${gis.stSetSrid}(${gis.stPoint}(r.last_seen_lng, r.last_seen_lat), 4326)::${gis.geography},
          u.geog,
          u.radius_meters
        )
    ),
    recent_sighting_matches as (
      select
        r.id,
        r.created_at,
        r.pet_name,
        r.pet_type,
        r.description,
        r.zone,
        r.last_seen_place,
        r.last_seen_lat,
        r.last_seen_lng,
        p.public_url as photo_url,
        r.status,
        min(${gis.stDistance}(
          ${gis.stSetSrid}(${gis.stPoint}(s.lng, s.lat), 4326)::${gis.geography},
          u.geog
        )) as distance_meters,
        false as has_lost_report_match,
        true as has_recent_sighting_match,
        max(s.seen_at) as latest_sighting_at,
        count(*)::integer as nearby_sightings_count
      from public.sightings s
      inner join public.pet_reports r on r.id = s.report_id
      left join lateral (
        select public_url
        from public.pet_photos
        where report_id = r.id
          and photo_type = 'report'
        order by is_primary desc, created_at desc
        limit 1
      ) p on true
      cross join user_location u
      where r.status = 'active'
        and s.status in ('visible', 'pending')
        and s.seen_at >= u.recent_since
        and ${gis.stDWithin}(
          ${gis.stSetSrid}(${gis.stPoint}(s.lng, s.lat), 4326)::${gis.geography},
          u.geog,
          u.radius_meters
        )
      group by
        r.id,
        r.created_at,
        r.pet_name,
        r.pet_type,
        r.description,
        r.zone,
        r.last_seen_place,
        r.last_seen_lat,
        r.last_seen_lng,
        p.public_url,
        r.status
    ),
    combined_matches as (
      select * from lost_report_matches
      union all
      select * from recent_sighting_matches
    )
    select
      id,
      created_at,
      pet_name,
      pet_type,
      description,
      zone,
      last_seen_place,
      last_seen_lat,
      last_seen_lng,
      photo_url,
      status,
      min(distance_meters) as distance_meters,
      bool_or(has_lost_report_match) as has_lost_report_match,
      bool_or(has_recent_sighting_match) as has_recent_sighting_match,
      max(latest_sighting_at) as latest_sighting_at,
      sum(nearby_sightings_count)::integer as nearby_sightings_count
    from combined_matches
    group by
      id,
      created_at,
      pet_name,
      pet_type,
      description,
      zone,
      last_seen_place,
      last_seen_lat,
      last_seen_lng,
      photo_url,
      status
    order by
      max(latest_sighting_at) desc nulls last,
      min(distance_meters) asc,
      created_at desc
    limit (select max_results from user_location)
  `;

  const result = await db.query(query, [lat, lng, radiusKm, recentHours, limit]);
  return result.rows.map(mapNearbyAlert);
}
