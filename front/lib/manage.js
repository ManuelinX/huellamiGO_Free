import { apiFetch } from "@/lib/api";
import { normalizeSighting } from "@/lib/sightings";

export function normalizeManagedReport(report) {
  if (!report) {
    return null;
  }

  return {
    ...report,
    isPrivateManagementView: true,
    publicPath: report.status === "active" ? `/mascotas/${report.id}` : "/",
    canOpenPublicReport: report.status === "active",
    canManageSightings: report.status !== "archived",
    manageToken: report.manageToken ?? null,
  };
}

function getManageHeaders(token) {
  return token ? { "X-Manage-Token": token } : undefined;
}

function normalizeManagedMapItem(item) {
  if (item.type === "sighting") {
    return {
      ...normalizeSighting(item),
      type: "sighting",
    };
  }

  return item;
}

export async function createManageSession(id, token) {
  const data = await apiFetch(`/api/manage/${id}/session`, {
    method: "POST",
    headers: getManageHeaders(token),
  });

  return normalizeManagedReport(data.report);
}

export async function getManagedReport(id, token) {
  const data = await apiFetch(`/api/manage/${id}`, {
    headers: getManageHeaders(token),
  });

  return normalizeManagedReport(data.report);
}

export async function getManagedSightings(reportId, token, { limit = 80 } = {}) {
  const params = new URLSearchParams();

  if (Number.isFinite(limit)) {
    params.set("limit", String(limit));
  }

  const data = await apiFetch(`/api/manage/${reportId}/sightings?${params.toString()}`, {
    headers: getManageHeaders(token),
  });

  return data.sightings.map(normalizeSighting);
}

export async function getManagedSightingMap(reportId, token, { bbox, zoom }) {
  const params = new URLSearchParams();

  params.set("bbox", bbox.join(","));
  params.set("zoom", String(zoom));

  const data = await apiFetch(`/api/manage/${reportId}/sightings/map?${params.toString()}`, {
    headers: getManageHeaders(token),
  });

  return {
    ...data,
    items: data.items.map(normalizeManagedMapItem),
  };
}

export async function getReviewedSearchZones(reportId, token) {
  const data = await apiFetch(`/api/manage/${reportId}/reviewed-zones`, {
    headers: getManageHeaders(token),
  });

  return data.zones;
}

export async function createReviewedSearchZone(reportId, token, zone) {
  const data = await apiFetch(`/api/manage/${reportId}/reviewed-zones`, {
    method: "POST",
    headers: getManageHeaders(token),
    body: zone,
  });

  return data.zone;
}

export async function deleteReviewedSearchZone(reportId, token, zoneId) {
  const data = await apiFetch(`/api/manage/${reportId}/reviewed-zones/${zoneId}`, {
    method: "DELETE",
    headers: getManageHeaders(token),
  });

  return data.deletedId;
}

export async function updateManagedReportStatus(id, token, status, reunionStory = {}) {
  const data = await apiFetch(`/api/manage/${id}/status`, {
    method: "PATCH",
    headers: getManageHeaders(token),
    body: {
      status,
      reunionStory,
    },
  });

  return normalizeManagedReport(data.report);
}

export async function updateManagedSighting({
  reportId,
  token,
  sightingId,
  status,
  isUseful,
  isTrailKey,
}) {
  const data = await apiFetch(
    `/api/manage/${reportId}/sightings/${sightingId}`,
    {
      method: "PATCH",
      headers: getManageHeaders(token),
      body: {
        status,
        isUseful,
        isTrailKey,
      },
    },
  );

  return normalizeSighting(data.sighting);
}
