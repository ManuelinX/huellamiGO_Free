import crypto from "crypto";

import { betaAccessCookieName } from "./cookies";
//segundos * minutos * horas * días 
const betaAccessMaxAgeSeconds = 60 * 60 * 24 * 0.34; 

function normalizeEmail(email) {
  return email?.toString().trim().toLowerCase();
}

function getAllowedEmails() {
  return (process.env.BETA_SHIELD_ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

function signPayload(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export function isBetaShieldEnabled() {
  return process.env.BETA_SHIELD_ENABLED === "true";
}

export function createBetaAccessToken(email) {
  const secret = process.env.BETA_SHIELD_SECRET;

  if (!secret) {
    throw new Error("BETA_SHIELD_SECRET no configurado");
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    email: normalizeEmail(email),
    iat: issuedAt,
    exp: issuedAt + betaAccessMaxAgeSeconds,
  })).toString("base64url");
  const signature = signPayload(payload, secret);

  return `${payload}.${signature}`;
}

export function canGrantBetaAccess({ email, accessCode }) {
  const normalizedEmail = normalizeEmail(email);

  if (!isBetaShieldEnabled()) {
    return true;
  }

  if (!normalizedEmail) {
    return false;
  }

  if (getAllowedEmails().includes(normalizedEmail)) {
    return true;
  }

  const configuredCode = process.env.BETA_SHIELD_ACCESS_CODE?.trim();

  return Boolean(configuredCode && accessCode?.toString().trim() === configuredCode);
}

export function getBetaAccessCookieOptions() {
  return {
    path: "/",
    maxAge: betaAccessMaxAgeSeconds,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  };
}

export { betaAccessCookieName };
