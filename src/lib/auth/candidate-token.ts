import { createHash, randomBytes } from "node:crypto";

const CANDIDATE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function hashCandidateToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export function generateCandidateToken() {
  return randomBytes(32).toString("base64url");
}

export function isCandidateToken(token: string) {
  return CANDIDATE_TOKEN_PATTERN.test(token);
}
