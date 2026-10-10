import crypto from "crypto";
import path from "path";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import multer from "multer";
import { Router } from "express";
import { getUserFromRequest, requireAuth } from "../utils/auth.js";
import { asyncHandler } from "../utils/http.js";
import { rateLimit } from "../utils/rate-limit.js";
import { assertSupportedImageFile, getImageExtension } from "../utils/upload-validation.js";
import { requireBetaAccessForUser } from "../middleware/beta-shield.js";

export const uploadsRouter = Router();

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const uploadRoot = path.resolve(currentDir, "../../uploads");
const maxPhotoSizeBytes = 6 * 1024 * 1024;
const petPhotoUploadRateLimit = rateLimit({
  name: "uploads:pet-photo",
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: "Demasiadas fotos subidas desde esta conexión. Intenta de nuevo más tarde.",
});
const petPhotoUserUploadRateLimit = rateLimit({
  name: "uploads:pet-photo:user",
  windowMs: 60 * 60 * 1000,
  max: 60,
  message: "Demasiadas fotos subidas desde esta cuenta. Intenta de nuevo más tarde.",
  keyGenerator(req) {
    const user = getUserFromRequest(req);

    return user ? `user:${user.id}` : null;
  },
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxPhotoSizeBytes,
    files: 1,
  },
});

function getPublicBaseUrl(req) {
  return process.env.PUBLIC_API_URL || `${req.protocol}://${req.get("host")}`;
}

uploadsRouter.post(
  "/pet-photo",
  petPhotoUploadRateLimit,
  petPhotoUserUploadRateLimit,
  upload.single("photo"),
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    requireBetaAccessForUser(req, user);
    const file = req.file;

    const contentType = assertSupportedImageFile(file, {
      invalidMessage: "La foto debe ser una imagen WebP o JPEG",
    });

    const userFolder = user.id;
    const fileName = `${crypto.randomUUID()}.${getImageExtension(contentType)}`;
    const storagePath = path.posix.join("pet-photos", userFolder, fileName);
    const diskPath = path.join(uploadRoot, "pet-photos", userFolder, fileName);

    await fs.mkdir(path.dirname(diskPath), { recursive: true });
    await fs.writeFile(diskPath, file.buffer);

    res.status(201).json({
      ok: true,
      photo: {
        storageBucket: "pet-photos",
        storagePath: path.posix.join(userFolder, fileName),
        publicUrl: `${getPublicBaseUrl(req)}/uploads/${storagePath}`,
        contentType,
        sizeBytes: file.size,
      },
    });
  }),
);
