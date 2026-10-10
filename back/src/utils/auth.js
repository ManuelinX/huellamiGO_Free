import crypto from "crypto";
import { createBadRequest } from "./http.js";
import { db } from "../db.js";

const jwtTtlSeconds = 60 * 60 * 24 * 7;

function base64UrlEncode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function verifyHs256(token, jwtSecret) {
  const [header, payload, signature] = token.split(".");

  if (!header || !payload || !signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", jwtSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  return (
    signatureBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  );
}

export function createAuthToken(user) {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET no configurado");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "HS256",
    typ: "JWT",
  };
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role ?? "authenticated",
    iat: now,
    exp: now + jwtTtlSeconds,
  };
  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(payload);
  const signature = crypto
    .createHmac("sha256", jwtSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function getBearerToken(req) {
  const authorization = req.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

export function getUserFromRequest(req) {
  const token = getBearerToken(req);

  if (!token) {
    return null;
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret || !verifyHs256(token, jwtSecret)) {
    return null;
  }

  try {
    const [, payload] = token.split(".");
    const claims = JSON.parse(base64UrlDecode(payload));

    if (!claims.sub) {
      return null;
    }

    if (claims.exp && Number(claims.exp) <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      id: claims.sub,
      email: claims.email,
      role: claims.role,
      claims
    };
  } catch (error) {
    return null;
  }
}

export function requireAuth(req) {
  const user = getUserFromRequest(req);

  if (!user) {
    const error = createBadRequest("Sesión requerida");
    error.statusCode = 401;
    throw error;
  }

  return user;
}

export async function requireVerifiedEmail(req) {
  const user = requireAuth(req);
  const result = await db.query(
    `
      SELECT email_verified_at
      FROM public.app_users
      WHERE id = $1
        AND status = 'active'
      LIMIT 1
    `,
    [user.id],
  );
  const row = result.rows[0];

  if (!row) {
    const error = createBadRequest("Sesión no encontrada");
    error.statusCode = 401;
    throw error;
  }

  if (!row.email_verified_at) {
    const error = createBadRequest("Verifica tu correo para continuar");
    error.statusCode = 403;
    error.details = { code: "EMAIL_NOT_VERIFIED" };
    error.publicDetails = { code: "EMAIL_NOT_VERIFIED" };
    throw error;
  }

  return user;
}
