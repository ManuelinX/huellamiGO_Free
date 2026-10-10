import { getAuthToken } from "@/lib/auth-session";
import { betaAccessCookieName, readBetaAccessToken } from "@/beta-shield/cookies";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function isFormDataBody(body) {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

async function getBetaAccessToken() {
  const browserToken = readBetaAccessToken();

  if (browserToken || typeof window !== "undefined") {
    return browserToken;
  }

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();

    return cookieStore.get(betaAccessCookieName)?.value ?? null;
  } catch {
    return null;
  }
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers);
  const hasFormDataBody = isFormDataBody(options.body);

  headers.set("Accept", "application/json");

  if (options.body && !hasFormDataBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth) {
    const token = getAuthToken();

    if (!token) {
      throw new Error("Necesitas iniciar sesión.");
    }

    headers.set("Authorization", `Bearer ${token}`);
  }

  const betaAccessToken = await getBetaAccessToken();

  if (betaAccessToken) {
    headers.set("X-Beta-Access", betaAccessToken);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
    credentials: options.credentials ?? "include",
    body: options.body && !hasFormDataBody && typeof options.body !== "string"
      ? JSON.stringify(options.body)
      : options.body,
    cache: options.cache ?? "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.error || `Error HTTP ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}
