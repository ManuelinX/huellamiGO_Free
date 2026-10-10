import { Router } from "express";
import { getGeocodingConfig, reverseGeocode } from "../services/geocoding.js";
import { asyncHandler, toNumber } from "../utils/http.js";
import { rateLimit } from "../utils/rate-limit.js";
import { requireSignedBetaAccess } from "../middleware/beta-shield.js";

export const geocodingRouter = Router();

const geocodingConfigRateLimit = rateLimit({
  name: "geocoding:config",
  windowMs: 60 * 1000,
  max: 60,
  message: "Demasiadas solicitudes de configuración. Intenta de nuevo más tarde.",
});
const reverseGeocodingRateLimit = rateLimit({
  name: "geocoding:reverse",
  windowMs: 60 * 1000,
  max: 120,
  message: "Demasiadas solicitudes de geocoding. Intenta de nuevo más tarde.",
});

geocodingRouter.get("/config", geocodingConfigRateLimit, (req, res) => {
  requireSignedBetaAccess(req);

  res.json({
    ok: true,
    geocoding: getGeocodingConfig(),
  });
});

geocodingRouter.get("/reverse", reverseGeocodingRateLimit, asyncHandler(async (req, res) => {
  requireSignedBetaAccess(req);
  const lat = toNumber(req.query.lat);
  const lng = toNumber(req.query.lng);
  const result = await reverseGeocode({ lat, lng });

  res.json({
    ok: true,
    result,
  });
}));
