import { preparePhotoForUpload } from "@/lib/image-processing";
import { apiFetch } from "@/lib/api";

function getPrimaryPhotoUrl(report) {
  const photos = report.pet_photos ?? [];
  const primaryPhoto = photos.find((photo) => photo.is_primary && photo.photo_type === "report");
  const reportPhoto = photos.find((photo) => photo.photo_type === "report");

  return primaryPhoto?.public_url ?? reportPhoto?.public_url ?? report.photo_url ?? report.photoUrl ?? null;
}

export function mapReportToPet(report) {
  const publicWhatsapp = Boolean(
    report.contact?.whatsappUrl ||
      report.whatsapp_url ||
      (report.public_whatsapp && report.contact_value),
  );
  const whatsappUrl =
    report.contact?.whatsappUrl ??
    report.whatsapp_url ??
    null;

  return {
    id: report.id,
    slug: report.id,
    name: report.pet_name,
    species: report.pet_type,
    zone: report.zone ?? "Zona no especificada",
    lastSeenWhen: "Reciente",
    status: report.status,
    sightingsCount: report.sightings_count ?? 0,
    manageExpiresAt: report.manage_expires_at,
    reunionStory: {
      photoUrl: report.reunion_photo_url,
      photoUrl2: report.reunion_photo_url_2,
      message: report.reunion_message,
      publicAllowed: report.reunion_public_allowed,
    },
    avatarClass: "avatarNina",
    shortDescription: report.description ?? "Sin descripción.",
    description: report.description ?? "Sin descripción.",
    coordinates: [
      report.last_seen_lat ?? 19.41273,
      report.last_seen_lng ?? -99.16988,
    ],
    reward: {
      enabled: report.reward_enabled,
      showAmount: report.reward_show_amount && report.reward_amount > 0,
      amount: report.reward_amount,
      currency: report.reward_currency ?? "MXN",
    },
    prioritySignals: {
      isVulnerable: Boolean(report.is_vulnerable ?? report.prioritySignals?.isVulnerable),
      isUrgent: Boolean(report.is_urgent ?? report.prioritySignals?.isUrgent),
      needsMedication: Boolean(report.needs_medication ?? report.prioritySignals?.needsMedication),
      lifeStage: report.pet_life_stage ?? report.prioritySignals?.lifeStage ?? "adult",
    },
    contact: {
      name: report.contact?.name ?? report.contact_name ?? "Familia",
      preferredMethod:
        report.contact?.preferredMethod ??
        report.preferred_contact ??
        "Mensaje por HuellamiGO",
      publicWhatsapp,
      masked:
        report.contact?.masked ??
        (publicWhatsapp ? "WhatsApp disponible" : "Contacto protegido"),
      whatsappUrl,
    },
    photoUrl: getPrimaryPhotoUrl(report),
  };
}

function isManagedReportExpired(report) {
  return (
    report.status === "reunited" &&
    report.manage_expires_at &&
    new Date(report.manage_expires_at).getTime() <= Date.now()
  );
}

export async function getLostPetReports() {
  const data = await apiFetch("/api/reports");
  return data.reports;
}

export async function getHomeLostPetReports() {
  return getLostPetReports();
}

export async function getMapLostPetReports({ bbox, zoom } = {}) {
  const params = new URLSearchParams({ status: "active" });

  if (bbox) {
    params.set("bbox", bbox.join(","));
  }

  if (Number.isFinite(zoom)) {
    params.set("zoom", String(zoom));
  }

  const data = await apiFetch(`/api/reports/map?${params.toString()}`);
  return data.items;
}

export async function getLostPetReportById(id) {
  const data = await apiFetch(`/api/reports/${id}`);
  return data.report;
}

export async function getPublicReunionStories() {
  const data = await apiFetch("/api/reports/reunion-stories");
  return data.stories;
}

export async function getMyReports() {
  const data = await apiFetch("/api/reports/mine", {
    auth: true,
  });
  return data.reports;
}

export async function createLostPetReport(report) {
  const photoUrl = report.photo_url ?? null;
  const { photo_url, ...reportPayload } = report;
  const data = await apiFetch("/api/reports", {
    method: "POST",
    auth: true,
    body: {
      ...reportPayload,
      photo_url: photoUrl,
    },
  });

  return data.report;
}

export async function uploadPetPhoto(file) {
  if (!file || file.size === 0) {
    return null;
  }

  const uploadFile = await preparePhotoForUpload(file);
  const formData = new FormData();

  formData.append("photo", uploadFile);

  const data = await apiFetch("/api/uploads/pet-photo", {
    method: "POST",
    auth: true,
    body: formData,
  });

  return data.photo.publicUrl;
}
