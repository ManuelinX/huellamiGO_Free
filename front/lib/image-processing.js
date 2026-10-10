const previewMaxWidth = 600;
const previewQuality = 0.72;
const mainMaxWidth = 1280;
const mainQuality = 0.88;
const avatarMaxSizeBytes = 32 * 1024;
const webpContentType = "image/webp";
const jpegContentType = "image/jpeg";

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("No se pudo leer la imagen."));
    };
    image.src = imageUrl;
  });
}

function getOptimizedName(file, suffix, extension) {
  const cleanName = file.name.replace(/\.[^.]+$/, "") || "foto";
  return `${cleanName}-${suffix}.${extension}`;
}

function getWebpName(file, suffix) {
  return getOptimizedName(file, suffix, "webp");
}

async function canvasToBlob(canvas, contentType, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, contentType, quality);
  });
}

async function isWebpBlob(blob) {
  if (!blob || blob.type !== webpContentType || blob.size < 12) {
    return false;
  }

  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const riff = String.fromCharCode(...header.slice(0, 4));
  const webp = String.fromCharCode(...header.slice(8, 12));

  return riff === "RIFF" && webp === "WEBP";
}

function isJpegBlob(blob) {
  return blob?.type === jpegContentType && blob.size > 0;
}

async function imageToOptimizedBlob(file, { maxWidth, quality, backgroundColor = "#ffffff" }) {
  const image = await loadImage(file);
  const scale = Math.min(1, maxWidth / image.naturalWidth);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;

  if (backgroundColor) {
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, width, height);
  }

  context.drawImage(image, 0, 0, width, height);

  const webpBlob = await canvasToBlob(canvas, webpContentType, quality);

  if (await isWebpBlob(webpBlob)) {
    return {
      blob: webpBlob,
      contentType: webpContentType,
      extension: "webp",
    };
  }

  const jpegBlob = await canvasToBlob(canvas, jpegContentType, quality);

  if (!isJpegBlob(jpegBlob)) {
    throw new Error("No se pudo optimizar la imagen.");
  }

  return {
    blob: jpegBlob,
    contentType: jpegContentType,
    extension: "jpg",
  };
}

async function imageToSquareWebpBlob(file, { size, quality }) {
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = Math.max(0, Math.round((image.naturalWidth - sourceSize) / 2));
  const sourceY = Math.max(0, Math.round((image.naturalHeight - sourceSize) / 2));

  canvas.width = size;
  canvas.height = size;
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, webpContentType, quality);
  });

  if (!blob) {
    throw new Error("No se pudo optimizar la imagen.");
  }

  return blob;
}

export async function preparePhotoForPreview(file, options = {}) {
  const optimized = await imageToOptimizedBlob(file, {
    maxWidth: previewMaxWidth,
    quality: previewQuality,
    backgroundColor: options.backgroundColor,
  });

  return {
    ...optimized,
    previewUrl: URL.createObjectURL(optimized.blob),
  };
}

export async function preparePhotoForUpload(file, options = {}) {
  const optimized = await imageToOptimizedBlob(file, {
    maxWidth: mainMaxWidth,
    quality: mainQuality,
    backgroundColor: options.backgroundColor,
  });

  return new File([optimized.blob], getOptimizedName(file, options.suffix ?? "principal", optimized.extension), {
    type: optimized.contentType,
  });
}

export async function prepareAvatarForUpload(file) {
  const attempts = [
    { size: 192, quality: 0.78 },
    { size: 160, quality: 0.72 },
    { size: 128, quality: 0.68 },
    { size: 96, quality: 0.64 },
  ];

  for (const attempt of attempts) {
    const blob = await imageToSquareWebpBlob(file, attempt);

    if (blob.size <= avatarMaxSizeBytes) {
      return new File([blob], getWebpName(file, "avatar"), {
        type: webpContentType,
      });
    }
  }

  throw new Error("La foto de perfil no pudo quedar debajo de 32KB.");
}

export async function preparePhotoState(file, options = {}) {
  const [preview, uploadFile] = await Promise.all([
    preparePhotoForPreview(file, options),
    preparePhotoForUpload(file, options),
  ]);

  return {
    file: uploadFile,
    previewUrl: preview.previewUrl,
    processed: true,
    message: uploadFile.type === webpContentType
      ? "Imagen optimizada: WebP para preview y foto principal."
      : "Imagen optimizada: JPEG compatible para este navegador.",
  };
}
