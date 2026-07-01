import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${KEY_LENGTH}$${salt}$${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, keyLengthRaw, salt, hash] = storedHash.split("$");

  if (algorithm !== "scrypt" || !keyLengthRaw || !salt || !hash) {
    return false;
  }

  const keyLength = Number.parseInt(keyLengthRaw, 10);
  if (!Number.isSafeInteger(keyLength) || keyLength <= 0) {
    return false;
  }

  const expected = Buffer.from(hash, "base64url");
  const actual = (await scrypt(password, salt, keyLength)) as Buffer;

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
