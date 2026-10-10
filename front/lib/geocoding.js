import { apiFetch } from "@/lib/api";

export async function getGeocodingConfig() {
  const data = await apiFetch("/api/geocoding/config");
  return data.geocoding;
}

export async function reverseGeocode({ lat, lng }) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
  });

  const data = await apiFetch(`/api/geocoding/reverse?${params.toString()}`);
  return data.result;
}
