import { db } from "../db.js";

const defaultPreferences = {
  notifySightingUpdates: true,
  notifyNearbyReports: true,
  radiusKm: 3,
  alertLat: null,
  alertLng: null,
  alertPlaceLabel: null,
  locationSource: "manual",
};

function mapNotificationPreferencesRow(row) {
  if (!row) {
    return {
      ...defaultPreferences,
      exists: false,
    };
  }

  return {
    notifySightingUpdates: row.notify_sighting_updates,
    notifyNearbyReports: row.notify_nearby_reports,
    radiusKm: Number(row.radius_km),
    alertLat: row.alert_lat ?? null,
    alertLng: row.alert_lng ?? null,
    alertPlaceLabel: row.alert_place_label ?? null,
    locationSource: row.location_source ?? "manual",
    exists: true,
  };
}

export async function getNotificationPreferences({ profileId, client = db }) {
  const result = await client.query(
    `
      SELECT
        notify_sighting_updates,
        notify_nearby_reports,
        radius_km,
        alert_lat,
        alert_lng,
        alert_place_label,
        location_source
      FROM public.notification_preferences
      WHERE profile_id = $1
      LIMIT 1
    `,
    [profileId],
  );

  return mapNotificationPreferencesRow(result.rows[0]);
}

export async function upsertNotificationPreferences({
  profileId,
  notifySightingUpdates = defaultPreferences.notifySightingUpdates,
  notifyNearbyReports = defaultPreferences.notifyNearbyReports,
  radiusKm = defaultPreferences.radiusKm,
  alertLat = defaultPreferences.alertLat,
  alertLng = defaultPreferences.alertLng,
  alertPlaceLabel = defaultPreferences.alertPlaceLabel,
  locationSource = defaultPreferences.locationSource,
  client = db,
}) {
  const result = await client.query(
    `
      INSERT INTO public.notification_preferences (
        profile_id,
        notify_sighting_updates,
        notify_nearby_reports,
        radius_km,
        alert_lat,
        alert_lng,
        alert_place_label,
        location_source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (profile_id) DO UPDATE
      SET
        notify_sighting_updates = EXCLUDED.notify_sighting_updates,
        notify_nearby_reports = EXCLUDED.notify_nearby_reports,
        radius_km = EXCLUDED.radius_km,
        alert_lat = EXCLUDED.alert_lat,
        alert_lng = EXCLUDED.alert_lng,
        alert_place_label = EXCLUDED.alert_place_label,
        location_source = EXCLUDED.location_source
      RETURNING
        notify_sighting_updates,
        notify_nearby_reports,
        radius_km,
        alert_lat,
        alert_lng,
        alert_place_label,
        location_source
    `,
    [
      profileId,
      notifySightingUpdates,
      notifyNearbyReports,
      radiusKm,
      alertLat,
      alertLng,
      alertPlaceLabel,
      locationSource,
    ],
  );

  return mapNotificationPreferencesRow(result.rows[0]);
}
