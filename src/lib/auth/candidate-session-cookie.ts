import { createHash } from "node:crypto";

export const CANDIDATE_SESSION_COOKIE_NAME = "interview_candidate_session";

export function getCandidateSessionCookieName(groupId: string) {
  const groupKey = createHash("sha256").update(groupId).digest("base64url").slice(0, 18);
  return `${CANDIDATE_SESSION_COOKIE_NAME}_${groupKey}`;
}
