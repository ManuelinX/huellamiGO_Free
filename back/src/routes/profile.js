import crypto from "crypto";
import path from "path";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import multer from "multer";
import { Router } from "express";
import { db } from "../db.js";
import { getProfile, updateProfile, updateProfileAvatar } from "../services/profile.js";
import { getUserFromRequest, requireAuth } from "../utils/auth.js";
import { asyncHandler, createBadRequest } from "../utils/http.js";
import { rateLimit } from "../utils/rate-limit.js";
import { assertWebpImageFile, webpContentType } from "../utils/upload-validation.js";
import { requireBetaAccessForUser } from "../middleware/beta-shield.js";

export const profileRouter = Router();

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const uploadRoot = path.resolve(currentDir, "../../uploads");
const maxAvatarSizeBytes = 32 * 1024;
const avatarUploadRateLimit = rateLimit({
  name: "profile:avatar",
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: "Demasiados cambios de avatar desde esta conexión. Intenta de nuevo más tarde.",
});
const avatarUserUploadRateLimit = rateLimit({
  name: "profile:avatar:user",
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: "Demasiados cambios de avatar desde esta cuenta. Intenta de nuevo más tarde.",
  keyGenerator(req) {
    const user = getUserFromRequest(req);

    return user ? `user:${user.id}` : null;
  },
});
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxAvatarSizeBytes,
    files: 1,
  },
});

function getPublicBaseUrl(req) {
  return process.env.PUBLIC_API_URL || `${req.protocol}://${req.get("host")}`;
}

function normalizeProfilePayload(body) {
  return {
    displayName: body.displayName?.toString().trim(),
    bio: body.bio?.toString().trim() || null,
    phone: body.phone?.toString().trim() || null,
    city: body.city?.toString().trim() || null,
    state: body.state?.toString().trim() || null,
  };
}

function assertProfilePayload(profile) {
  if (!profile.displayName) {
    throw createBadRequest("Nombre visible es obligatorio");
  }

  if (profile.displayName.length > 80) {
    throw createBadRequest("Nombre visible demasiado largo");
  }

  if (profile.bio && profile.bio.length > 240) {
    throw createBadRequest("Bio demasiado larga");
  }

  if (profile.phone && profile.phone.length > 40) {
    throw createBadRequest("Teléfono demasiado largo");
  }
}

function assertAvatar(file) {
  assertWebpImageFile(file, {
    requiredMessage: "Avatar requerido",
    invalidMessage: "El avatar debe ser una imagen WebP",
  });

  if (file.size > maxAvatarSizeBytes) {
    throw createBadRequest("El avatar no debe superar 32KB");
  }
}

profileRouter.get("/", asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  requireBetaAccessForUser(req, user);
  const profile = await getProfile({ profileId: user.id });

  if (!profile) {
    res.status(404).json({ ok: false, error: "Perfil no encontrado" });
    return;
  }

  res.json({
    ok: true,
    profile,
  });
}));

profileRouter.patch("/", asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  requireBetaAccessForUser(req, user);
  const profile = normalizeProfilePayload(req.body);

  assertProfilePayload(profile);

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await updateProfile({
      profileId: user.id,
      ...profile,
      client,
    });

    const updatedProfile = await getProfile({
      profileId: user.id,
      client,
    });

    await client.query("COMMIT");

    res.json({
      ok: true,
      profile: updatedProfile,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

profileRouter.post("/avatar", avatarUploadRateLimit, avatarUserUploadRateLimit, avatarUpload.single("avatar"), asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  requireBetaAccessForUser(req, user);
  const file = req.file;

  assertAvatar(file);

  const userFolder = user.id;
  const fileName = `${crypto.randomUUID()}.webp`;
  const storagePath = path.posix.join("profile-avatars", userFolder, fileName);
  const diskPath = path.join(uploadRoot, "profile-avatars", userFolder, fileName);
  const avatarUrl = `${getPublicBaseUrl(req)}/uploads/${storagePath}`;

  await fs.mkdir(path.dirname(diskPath), { recursive: true });
  await fs.writeFile(diskPath, file.buffer);
  await updateProfileAvatar({
    profileId: user.id,
    avatarUrl,
  });

  const profile = await getProfile({ profileId: user.id });

  res.status(201).json({
    ok: true,
    profile,
    avatar: {
      publicUrl: avatarUrl,
      contentType: webpContentType,
      sizeBytes: file.size,
    },
  });
}));
