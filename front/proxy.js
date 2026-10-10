import { NextResponse } from "next/server";

import { betaAccessCookieName } from "./beta-shield/cookies";

const textEncoder = new TextEncoder();

function isBetaShieldEnabled() {
  return process.env.BETA_SHIELD_ENABLED === "true";
}

function isPublicPath(pathname) {
  return (
    pathname === "/beta-access" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/fonts/") ||
    pathname.match(/\.(?:ico|png|jpg|jpeg|webp|svg|css|js|woff2?|ttf|map|txt|xml|json)$/)
  );
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return result === 0;
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);

  return atob(`${base64}${padding}`);
}

function hasValidExpiration(payload) {
  try {
    const claims = JSON.parse(decodeBase64Url(payload));
    const now = Math.floor(Date.now() / 1000);

    return Number.isSafeInteger(claims.exp) && claims.exp > now;
  } catch {
    return false;
  }
}

async function signPayload(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));

  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function hasValidBetaAccess(token) {
  const secret = process.env.BETA_SHIELD_SECRET;

  if (!secret || !token) {
    return false;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return false;
  }

  const expectedSignature = await signPayload(payload, secret);

  return timingSafeEqual(signature, expectedSignature) && hasValidExpiration(payload);
}

export async function proxy(request) {
  if (!isBetaShieldEnabled()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const token = request.cookies.get(betaAccessCookieName)?.value;
  const hasAccess = await hasValidBetaAccess(token);

  if (pathname === "/beta-access" && hasAccess) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isPublicPath(pathname) || hasAccess) {
    return NextResponse.next();
  }

  const accessUrl = new URL("/beta-access", request.url);
  accessUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);

  return NextResponse.redirect(accessUrl);
}

export const config = {
  matcher: ["/((?!api).*)"],
};
