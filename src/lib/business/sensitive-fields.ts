const CANDIDATE_FORBIDDEN_RESPONSE_KEYS = [
  "adminNotes",
  "internalNote",
  "reasonInternal",
  "availableCandidateCount",
  "auditLogs",
  "adminEmail",
  "adminEmails"
] as const;

export function candidateResponseContainsSensitiveField(value: unknown) {
  const serialized = JSON.stringify(value);
  return CANDIDATE_FORBIDDEN_RESPONSE_KEYS.some((key) => serialized.includes(key));
}

export { CANDIDATE_FORBIDDEN_RESPONSE_KEYS };
