import { apiFetch } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-session";

export async function getPresenceStats() {
  return apiFetch("/api/presence");
}

export async function sendPresenceHeartbeat(visitorId) {
  const token = getAuthToken();

  return apiFetch("/api/presence/heartbeat", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: { visitorId },
  });
}
