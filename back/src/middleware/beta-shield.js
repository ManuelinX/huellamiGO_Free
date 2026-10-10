import crypto from "crypto";

import { createBadRequest } from "../utils/http.js";

const betaAccessHeader = "x-beta-access";

function isBetaShieldEnabled() {
  return process.env.BETA_SHIELD_ENABLED === "true";
}

function normalizeEmail(email) {
  return email?.toString().trim().toLowerCase();
}

function getAllowedEmails() {
  return (process.env.BETA_SHIELD_ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

function createBetaAccessError() {
  const error = createBadRequest("Acceso beta requerido");
  error.statusCode = 403;
  error.details = { code: "BETA_ACCESS_REQUIRED" };
  error.publicDetails = { code: "BETA_ACCESS_REQUIRED" };
  return error;
}

function hasValidExpiration(claims) {
  const now = Math.floor(Date.now() / 1000);

  return Number.isSafeInteger(claims.exp) && claims.exp > now;
}

function getSignedBetaAccess(req) {
  const token = req.get(betaAccessHeader);
  const secret = process.env.BETA_SHIELD_SECRET;

  if (!token || !secret) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const email = normalizeEmail(claims.email);

    return email && hasValidExpiration(claims) ? { email, claims } : null;
  } catch {
    return null;
  }
}

export function isBetaEmailAllowed(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return false;
  }

  return getAllowedEmails().includes(normalizedEmail);
}

export function hasBetaAccessForEmail(req, email) {
  if (!isBetaShieldEnabled()) {
    return true;
  }

  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return false;
  }

  if (isBetaEmailAllowed(normalizedEmail)) {
    return true;
  }

  const betaAccess = getSignedBetaAccess(req);

  return betaAccess?.email === normalizedEmail;
}

export function requireBetaAccessForEmail(req, email) {
  if (!hasBetaAccessForEmail(req, email)) {
    throw createBetaAccessError();
  }
}

export function requireBetaAccessForUser(req, user) {
  requireBetaAccessForEmail(req, user?.email);
}

export function requireSignedBetaAccess(req) {
  if (!isBetaShieldEnabled()) {
    return;
  }

  if (!getSignedBetaAccess(req)) {
    throw createBetaAccessError();
  }
}
