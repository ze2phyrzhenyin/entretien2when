import { createHash, randomBytes } from "node:crypto";
import { isCandidateToken } from "@/lib/auth/candidate-token-format";

export { isCandidateToken };

export function hashCandidateToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export function generateCandidateToken() {
  return randomBytes(32).toString("base64url");
}
