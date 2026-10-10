import crypto from "crypto";

const inviteTtlSeconds = 150;

let activeInvite = null;

function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function createCode() {
  return crypto.randomBytes(18).toString("base64url");
}

function getNowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function isActiveInvite(invite) {
  return Boolean(
    invite
    && !invite.revokedAt
    && !invite.redeemedAt
    && invite.expiresAt > getNowSeconds(),
  );
}

export function createBetaQrInvite({ createdBy }) {
  const code = createCode();
  const now = getNowSeconds();

  activeInvite = {
    code,
    codeHash: hashCode(code),
    createdAt: now,
    expiresAt: now + inviteTtlSeconds,
    createdBy,
    revokedAt: null,
    redeemedAt: null,
    redeemedByEmail: null,
  };

  return {
    code,
    expiresAt: activeInvite.expiresAt,
    ttlSeconds: inviteTtlSeconds,
  };
}

export function getActiveBetaQrInvite() {
  if (!isActiveInvite(activeInvite)) {
    return null;
  }

  return {
    code: activeInvite.code,
    expiresAt: activeInvite.expiresAt,
    ttlSeconds: Math.max(0, activeInvite.expiresAt - getNowSeconds()),
    createdBy: activeInvite.createdBy,
  };
}

export function redeemBetaQrInvite({ code, email }) {
  if (!code || !email || !isActiveInvite(activeInvite)) {
    return null;
  }

  const incomingHash = hashCode(code);
  const incomingBuffer = Buffer.from(incomingHash);
  const activeBuffer = Buffer.from(activeInvite.codeHash);
  const matches = incomingBuffer.length === activeBuffer.length
    && crypto.timingSafeEqual(incomingBuffer, activeBuffer);

  if (!matches) {
    return null;
  }

  activeInvite.redeemedAt = getNowSeconds();
  activeInvite.redeemedByEmail = email;

  return {
    createdBy: activeInvite.createdBy,
    redeemedAt: activeInvite.redeemedAt,
    redeemedByEmail: activeInvite.redeemedByEmail,
  };
}
