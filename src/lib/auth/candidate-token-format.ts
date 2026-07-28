const CANDIDATE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isCandidateToken(token: string) {
  return CANDIDATE_TOKEN_PATTERN.test(token);
}
