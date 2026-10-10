import { apiFetch } from "@/lib/api";

export async function getActiveBetaInvite() {
  return apiFetch("/api/beta-invites/active", {
    auth: true,
  });
}

export async function generateBetaInvite() {
  return apiFetch("/api/beta-invites/generate", {
    method: "POST",
    auth: true,
  });
}
