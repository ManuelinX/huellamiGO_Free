import crypto from "crypto";
import { promisify } from "util";

const scrypt = promisify(crypto.scrypt);
const keyLength = 64;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const derivedKey = await scrypt(password, salt, keyLength);

  return `scrypt:${salt}:${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password, passwordHash) {
  const [algorithm, salt, storedKey] = passwordHash.split(":");

  if (algorithm !== "scrypt" || !salt || !storedKey) {
    return false;
  }

  const derivedKey = await scrypt(password, salt, keyLength);
  const storedKeyBuffer = Buffer.from(storedKey, "base64url");

  return (
    derivedKey.length === storedKeyBuffer.length &&
    crypto.timingSafeEqual(derivedKey, storedKeyBuffer)
  );
}
