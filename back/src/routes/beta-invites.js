import { Router } from "express";

import { asyncHandler, createBadRequest } from "../utils/http.js";
import { requireAuth } from "../utils/auth.js";
import {
  createBetaQrInvite,
  getActiveBetaQrInvite,
  redeemBetaQrInvite,
} from "../services/beta-qr-invites.js";
import { isBetaShieldAdminEmail } from "../services/beta-admins.js";
import { isBetaTesterEmailAllowed, upsertBetaTester } from "../services/beta-testers.js";

export const betaInvitesRouter = Router();

function normalizeEmail(email) {
  return email?.toString().trim().toLowerCase();
}

function requireBetaInviteAdmin(req) {
  const user = requireAuth(req);

  if (!isBetaShieldAdminEmail(user.email)) {
    const error = createBadRequest("Admin beta requerido");
    error.statusCode = 403;
    error.publicDetails = { code: "BETA_INVITE_ADMIN_REQUIRED" };
    throw error;
  }

  return user;
}

betaInvitesRouter.get("/active", (req, res) => {
  requireBetaInviteAdmin(req);

  res.json({
    ok: true,
    invite: getActiveBetaQrInvite(),
  });
});

betaInvitesRouter.post("/generate", (req, res) => {
  const user = requireBetaInviteAdmin(req);
  const invite = createBetaQrInvite({ createdBy: user.email });

  res.json({
    ok: true,
    invite,
  });
});

betaInvitesRouter.post("/redeem", asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = req.body.code?.toString().trim();

  if (!email || !code) {
    const error = createBadRequest("Correo y codigo requeridos");
    error.statusCode = 400;
    throw error;
  }

  const redeemed = redeemBetaQrInvite({ code, email });

  if (!redeemed) {
    const error = createBadRequest("Codigo beta expirado o invalido");
    error.statusCode = 403;
    error.publicDetails = { code: "BETA_INVITE_INVALID" };
    throw error;
  }

  await upsertBetaTester({
    email,
    invitedByEmail: redeemed.createdBy,
    source: "qr",
  });

  res.json({
    ok: true,
  });
}));

betaInvitesRouter.post("/check-email", asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);

  if (!email) {
    const error = createBadRequest("Correo requerido");
    error.statusCode = 400;
    throw error;
  }

  const allowed = await isBetaTesterEmailAllowed(email);

  res.json({
    ok: true,
    allowed,
  });
}));
