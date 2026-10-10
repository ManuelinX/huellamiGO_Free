import { Router } from "express";
import { findNearbyAlerts } from "../services/nearby-alerts.js";
import { asyncHandler, clamp, createBadRequest, toNumber } from "../utils/http.js";
import { requireSignedBetaAccess } from "../middleware/beta-shield.js";

export const nearbyAlertsRouter = Router();

nearbyAlertsRouter.get("/", asyncHandler(async (req, res) => {
  requireSignedBetaAccess(req);
  const lat = toNumber(req.query.lat);
  const lng = toNumber(req.query.lng);

  if (lat === null || lng === null) {
    throw createBadRequest("lat y lng son requeridos y deben ser números");
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw createBadRequest("lat o lng estan fuera de rango", { lat, lng });
  }

  const radiusKm = clamp(toNumber(req.query.radiusKm, 3), 0.2, 50);
  const recentHours = clamp(toNumber(req.query.recentHours, 72), 1, 168);
  const limit = Math.trunc(clamp(toNumber(req.query.limit, 30), 1, 100));

  const alerts = await findNearbyAlerts({
    lat,
    lng,
    radiusKm,
    recentHours,
    limit
  });

  res.json({
    ok: true,
    filters: {
      lat,
      lng,
      radiusKm,
      recentHours,
      limit
    },
    alerts
  });
}));
