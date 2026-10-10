import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { db } from "./db.js";
import { nearbyAlertsRouter } from "./routes/nearby-alerts.js";
import { reportsRouter } from "./routes/reports.js";
import { manageRouter } from "./routes/manage.js";
import { uploadsRouter } from "./routes/uploads.js";
import { authRouter } from "./routes/auth.js";
import { presenceRouter } from "./routes/presence.js";
import { notificationsRouter } from "./routes/notifications.js";
import { profileRouter } from "./routes/profile.js";
import { geocodingRouter } from "./routes/geocoding.js";
import { betaInvitesRouter } from "./routes/beta-invites.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.resolve(currentDir, "../uploads");
const uploadCacheMaxAgeMs = 1000 * 60 * 60 * 24 * 30;

function getErrorResponseBody(error, statusCode) {
  const body = {
    ok: false,
    error: error.code === "LIMIT_FILE_SIZE"
      ? "La foto supera el limite permitido"
      : statusCode === 500 ? "Error interno del servidor" : error.message,
  };

  if (error.publicDetails && typeof error.publicDetails === "object") {
    body.details = error.publicDetails;
  }

  return body;
}

export function createApp() {
  const app = express();
  //app.set("trust proxy", true); // Si la app está detrás de un proxy confiable
  app.set("trust proxy", 1);

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }));

  const allowedOrigins = config.cors.allowedOrigins;

  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origen no permitido por CORS"));
    },
    credentials: true,
  }));

  app.use(express.json());
  app.use("/uploads", express.static(uploadsRoot, {
    dotfiles: "deny",
    immutable: true,
    index: false,
    maxAge: uploadCacheMaxAgeMs,
    setHeaders(res) {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  }));

  app.get("/", (req, res) => {
    res.json({
      ok: true,
      name: "API HuellamiGO",
      message: "Backend funcionando"
    });
  });

  app.use("/api/reports", reportsRouter);
  app.use("/api/manage", manageRouter);
  app.use("/api/nearby-alerts", nearbyAlertsRouter);
  app.use("/api/uploads", uploadsRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/presence", presenceRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api/geocoding", geocodingRouter);
  app.use("/api/beta-invites", betaInvitesRouter);

  app.use((error, req, res, next) => {
    console.error(error);

    const statusCode = error.statusCode || (error.code === "LIMIT_FILE_SIZE" ? 400 : 500);

    res.status(statusCode).json(getErrorResponseBody(error, statusCode));
  });

  return app;
}
