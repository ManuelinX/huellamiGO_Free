const bucketName = "pet-photos";
const webpExtensionPattern = /\.webp$/i;
const jpegExtensionPattern = /\.jpe?g$/i;

export function getStoragePathFromPublicUrl(publicUrl) {
  if (!publicUrl) {
    return null;
  }

  const marker = `/${bucketName}/`;
  const [, path] = publicUrl.split(marker);
  return path ?? publicUrl.split("/").pop() ?? publicUrl;
}

export function getPhotoContentTypeFromUrl(publicUrl) {
  const pathname = (() => {
    try {
      return new URL(publicUrl).pathname;
    } catch {
      return publicUrl;
    }
  })();

  if (webpExtensionPattern.test(pathname)) {
    return "image/webp";
  }

  if (jpegExtensionPattern.test(pathname)) {
    return "image/jpeg";
  }

  return null;
}
