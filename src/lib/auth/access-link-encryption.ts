import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const LOCAL_DEVELOPMENT_KEY = createHash("sha256")
  .update("when2entretien-local-candidate-access-link-key")
  .digest();

function encryptionKey() {
  const configured = process.env.CANDIDATE_ACCESS_ENCRYPTION_KEY?.trim();
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CANDIDATE_ACCESS_ENCRYPTION_KEY is required in production.");
    }
    return LOCAL_DEVELOPMENT_KEY;
  }

  const key = Buffer.from(configured, "base64url");
  if (key.length !== 32) {
    throw new Error("CANDIDATE_ACCESS_ENCRYPTION_KEY must be 32 base64url-encoded bytes.");
  }
  return key;
}

export function encryptCandidateAccessContent(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url")
  ].join(".");
}

export function decryptCandidateAccessContent(value: string) {
  const [version, ivRaw, tagRaw, encryptedRaw] = value.split(".");
  if (version !== "v1" || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Encrypted candidate access content is invalid.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivRaw, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
