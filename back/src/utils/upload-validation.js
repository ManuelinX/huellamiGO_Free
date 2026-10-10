import { createBadRequest } from "./http.js";

export const webpContentType = "image/webp";
export const jpegContentType = "image/jpeg";
export const supportedImageContentTypes = new Set([webpContentType, jpegContentType]);

export function isWebpBuffer(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length >= 12
    && buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WEBP";
}

export function isJpegBuffer(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length >= 3
    && buffer[0] === 0xff
    && buffer[1] === 0xd8
    && buffer[2] === 0xff;
}

export function getSupportedImageContentType(file) {
  if (!file) {
    return null;
  }

  if (file.mimetype === webpContentType && isWebpBuffer(file.buffer)) {
    return webpContentType;
  }

  if (file.mimetype === jpegContentType && isJpegBuffer(file.buffer)) {
    return jpegContentType;
  }

  return null;
}

export function getImageExtension(contentType) {
  return contentType === jpegContentType ? "jpg" : "webp";
}

export function assertWebpImageFile(file, {
  requiredMessage = "Foto requerida",
  invalidMessage = "El archivo debe ser una imagen WebP",
} = {}) {
  if (!file) {
    throw createBadRequest(requiredMessage);
  }

  if (file.mimetype !== webpContentType || !isWebpBuffer(file.buffer)) {
    throw createBadRequest(invalidMessage);
  }
}

export function assertSupportedImageFile(file, {
  requiredMessage = "Foto requerida",
  invalidMessage = "La foto debe ser una imagen WebP o JPEG",
} = {}) {
  if (!file) {
    throw createBadRequest(requiredMessage);
  }

  const contentType = getSupportedImageContentType(file);

  if (!contentType) {
    throw createBadRequest(invalidMessage);
  }

  return contentType;
}
