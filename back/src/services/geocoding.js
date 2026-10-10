import { db } from "../db.js";
import { config } from "../config.js";
import { getPostgisSqlNames } from "./postgis.js";

function mapGeocodingCacheRow(row) {
  return {
    id: row.id,
    formattedAddress: row.formatted_address,
    country: row.country,
    state: row.state,
    city: row.city,
    municipality: row.municipality,
    neighborhood: row.neighborhood,
    postcode: row.postcode,
    street: row.street,
    placeName: row.place_name,
    confidence: row.confidence,
    quality: row.quality,
    source: row.provider,
    cached: true,
    cache: {
      hitCount: Number(row.hit_count ?? 0),
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
      distanceMeters: Math.round(Number(row.distance_meters ?? 0)),
    },
  };
}

function mapSavedGeocodingCacheRow(row) {
  const mapped = mapGeocodingCacheRow(row);

  return {
    ...mapped,
    cached: false,
    cache: {
      ...mapped.cache,
      distanceMeters: 0,
    },
  };
}

function getCurrentMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function createHttpError(message, statusCode, details = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function createCoordinateFallback({ lat, lng, reason }) {
  const formattedCoordinates = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  return {
    formattedAddress: formattedCoordinates,
    country: null,
    state: null,
    city: null,
    municipality: null,
    neighborhood: null,
    postcode: null,
    street: null,
    placeName: formattedCoordinates,
    confidence: null,
    quality: "coordinates_only",
    source: "coordinates",
    cached: false,
    fallbackReason: reason,
  };
}

function getContextName(context, key) {
  const value = context?.[key];

  if (!value) {
    return null;
  }

  return value.name || value.text || value.id || null;
}

function pickFeature(features = []) {
  return features[0] ?? null;
}

function normalizeMapboxResponse({ lat, lng, payload }) {
  const feature = pickFeature(payload?.features);

  if (!feature) {
    return {
      formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      country: null,
      state: null,
      city: null,
      municipality: null,
      neighborhood: null,
      postcode: null,
      street: null,
      placeName: null,
      confidence: null,
      quality: "no_results",
      source: "mapbox",
      cached: false,
    };
  }

  const properties = feature.properties ?? {};
  const context = properties.context ?? {};
  const placeName = properties.full_address
    || [properties.name, properties.place_formatted].filter(Boolean).join(", ")
    || properties.name
    || null;
  const featureType = properties.feature_type ?? feature.type ?? null;
  const street = getContextName(context, "street")
    || (featureType === "street" ? properties.name : null);
  const result = {
    formattedAddress: placeName || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    country: getContextName(context, "country"),
    state: getContextName(context, "region"),
    city: getContextName(context, "place") || getContextName(context, "locality"),
    municipality: getContextName(context, "district"),
    neighborhood: getContextName(context, "neighborhood"),
    postcode: getContextName(context, "postcode"),
    street,
    placeName,
    confidence: properties.match_code?.confidence ?? properties.coordinates?.accuracy ?? null,
    quality: featureType,
    mapboxId: properties.mapbox_id ?? feature.id ?? null,
    source: "mapbox",
    cached: false,
  };

  Object.defineProperty(result, "rawResponse", {
    value: payload,
    enumerable: false,
  });

  return result;
}

export function getGeocodingConfig() {
  return {
    enabled: Boolean(config.geocoding.mapboxEnabled && config.geocoding.mapboxAccessToken),
    provider: "mapbox",
    cacheRadiusMeters: config.geocoding.cacheRadiusMeters,
    cacheTtlDays: config.geocoding.cacheTtlDays,
    cacheMaxRows: config.geocoding.cacheMaxRows,
    monthlyLimit: config.geocoding.monthlyLimit,
  };
}

export function assertValidCoordinates({ lat, lng }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const error = new Error("lat y lng son requeridos y deben ser números");
    error.statusCode = 400;
    throw error;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    const error = new Error("lat o lng estan fuera de rango");
    error.statusCode = 400;
    error.details = { lat, lng };
    throw error;
  }
}

export async function findCachedReverseGeocode({
  lat,
  lng,
  radiusMeters = config.geocoding.cacheRadiusMeters,
  client = db,
}) {
  assertValidCoordinates({ lat, lng });

  const gis = getPostgisSqlNames();
  const result = await client.query(
    `
      with search_point as (
        select ${gis.stSetSrid}(${gis.stPoint}($1, $2), 4326)::${gis.geography} as point
      ),
      cache_hit as (
        select
          gc.*,
          ${gis.stDistance}(gc.point, sp.point) as distance_meters
        from public.geocoding_cache gc
        cross join search_point sp
        where (gc.expires_at is null or gc.expires_at > now())
          and ${gis.stDWithin}(gc.point, sp.point, $3)
        order by distance_meters asc
        limit 1
      )
      update public.geocoding_cache gc
      set
        hit_count = gc.hit_count + 1,
        last_used_at = now()
      from cache_hit ch
      where gc.id = ch.id
      returning
        gc.*,
        ch.distance_meters
    `,
    [lng, lat, radiusMeters],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapGeocodingCacheRow(result.rows[0]);
}

export async function saveGeocodingCache({
  lat,
  lng,
  result,
  client = db,
}) {
  assertValidCoordinates({ lat, lng });

  const gis = getPostgisSqlNames();
  const rawResponse = result.rawResponse ?? null;
  const insertResult = await client.query(
    `
      insert into public.geocoding_cache (
        provider,
        lat,
        lng,
        point,
        formatted_address,
        country,
        state,
        city,
        municipality,
        neighborhood,
        postcode,
        street,
        place_name,
        confidence,
        quality,
        raw_response,
        hit_count,
        expires_at
      )
      values (
        'mapbox',
        $1,
        $2,
        ${gis.stSetSrid}(${gis.stPoint}($2, $1), 4326)::${gis.geography},
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        0,
        now() + ($15::integer * interval '1 day')
      )
      returning *
    `,
    [
      lat,
      lng,
      result.formattedAddress,
      result.country,
      result.state,
      result.city,
      result.municipality,
      result.neighborhood,
      result.postcode,
      result.street,
      result.placeName,
      result.confidence,
      result.quality,
      rawResponse,
      config.geocoding.cacheTtlDays,
    ],
  );

  return mapSavedGeocodingCacheRow(insertResult.rows[0]);
}

export async function cleanupGeocodingCache({
  maxRows = config.geocoding.cacheMaxRows,
  client = db,
} = {}) {
  const expiredResult = await client.query(
    `
      delete from public.geocoding_cache
      where expires_at <= now()
    `,
  );
  const countResult = await client.query("select count(*)::integer as count from public.geocoding_cache");
  const rowCount = Number(countResult.rows[0]?.count ?? 0);
  const overflowCount = Math.max(0, rowCount - maxRows);

  if (overflowCount === 0) {
    return {
      expiredDeleted: expiredResult.rowCount,
      overflowDeleted: 0,
      remainingRows: rowCount,
    };
  }

  const overflowResult = await client.query(
    `
      delete from public.geocoding_cache
      where id in (
        select id
        from public.geocoding_cache
        order by
          hit_count asc,
          last_used_at asc nulls first,
          created_at asc
        limit $1
      )
    `,
    [overflowCount],
  );

  return {
    expiredDeleted: expiredResult.rowCount,
    overflowDeleted: overflowResult.rowCount,
    remainingRows: rowCount - overflowResult.rowCount,
  };
}

export async function reserveMapboxUsage({ client = db } = {}) {
  const { monthlyLimit } = getGeocodingConfig();

  if (monthlyLimit <= 0) {
    return {
      allowed: false,
      reason: "monthly_limit_disabled",
      requestCount: 0,
      monthlyLimit,
      tableReady: true,
    };
  }

  const tableResult = await client.query("select to_regclass('public.geocoding_provider_usage') as table_name");

  if (!tableResult.rows[0]?.table_name) {
    return {
      allowed: true,
      requestCount: 0,
      monthlyLimit,
      tableReady: false,
    };
  }

  const usageResult = await client.query(
    `
      insert into public.geocoding_provider_usage (
        provider,
        period_month,
        request_count
      )
      values ('mapbox', $1::date, 1)
      on conflict (provider, period_month) do update
      set request_count = public.geocoding_provider_usage.request_count + 1
      where public.geocoding_provider_usage.request_count < $2
      returning request_count
    `,
    [getCurrentMonthStart(), monthlyLimit],
  );

  if (usageResult.rows.length === 0) {
    const currentUsageResult = await client.query(
      `
        select request_count
        from public.geocoding_provider_usage
        where provider = 'mapbox'
          and period_month = $1::date
      `,
      [getCurrentMonthStart()],
    );

    return {
      allowed: false,
      reason: "monthly_limit_reached",
      requestCount: Number(currentUsageResult.rows[0]?.request_count ?? monthlyLimit),
      monthlyLimit,
      tableReady: true,
    };
  }

  return {
    allowed: true,
    requestCount: Number(usageResult.rows[0].request_count),
    monthlyLimit,
    tableReady: true,
  };
}

export async function fetchMapboxReverseGeocode({ lat, lng }) {
  const geocodingConfig = getGeocodingConfig();

  if (!geocodingConfig.enabled) {
    throw createHttpError("Geocoding no configurado", 503, {
      reason: "mapbox_not_configured",
    });
  }

  const usage = await reserveMapboxUsage();

  if (!usage.allowed) {
    return createCoordinateFallback({ lat, lng, reason: usage.reason });
  }

  const params = new URLSearchParams({
    longitude: String(lng),
    latitude: String(lat),
    access_token: config.geocoding.mapboxAccessToken,
    permanent: "true",
    language: "es",
  });
  const response = await fetch(`https://api.mapbox.com/search/geocode/v6/reverse?${params.toString()}`);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw createHttpError("Mapbox Geocoding respondió con error", response.status, {
      provider: "mapbox",
      status: response.status,
      error: payload?.message ?? response.statusText,
    });
  }

  return normalizeMapboxResponse({ lat, lng, payload });
}

export async function reverseGeocode({ lat, lng }) {
  assertValidCoordinates({ lat, lng });

  const cachedResult = await findCachedReverseGeocode({ lat, lng });

  if (cachedResult) {
    return cachedResult;
  }

  const mapboxResult = await fetchMapboxReverseGeocode({ lat, lng });

  if (mapboxResult.source !== "mapbox") {
    return mapboxResult;
  }

  const recheckedCachedResult = await findCachedReverseGeocode({ lat, lng });

  if (recheckedCachedResult) {
    return recheckedCachedResult;
  }

  const savedResult = await saveGeocodingCache({
    lat,
    lng,
    result: mapboxResult,
  });

  await cleanupGeocodingCache();

  return savedResult;
}
