export const GROUP_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const DEFAULT_GROUP_CODE_GROUPS = 5;
export const DEFAULT_GROUP_CODE_GROUP_LENGTH = 4;
export const MAX_GROUP_CODE_INPUT_LENGTH = 64;

export type GenerateGroupCodeOptions = {
  groups?: number;
  groupLength?: number;
};

function secureRandomInt(maxExclusive: number) {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure random generator is unavailable.");
  }

  const values = new Uint32Array(1);
  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - (maxUint32 % maxExclusive);

  do {
    globalThis.crypto.getRandomValues(values);
  } while ((values[0] ?? 0) >= limit);

  return (values[0] ?? 0) % maxExclusive;
}

export function generateGroupCode(options: GenerateGroupCodeOptions = {}) {
  const groups = options.groups ?? DEFAULT_GROUP_CODE_GROUPS;
  const groupLength = options.groupLength ?? DEFAULT_GROUP_CODE_GROUP_LENGTH;
  const chunks: string[] = [];

  for (let groupIndex = 0; groupIndex < groups; groupIndex += 1) {
    let chunk = "";
    for (let charIndex = 0; charIndex < groupLength; charIndex += 1) {
      chunk += GROUP_CODE_ALPHABET.charAt(secureRandomInt(GROUP_CODE_ALPHABET.length));
    }
    chunks.push(chunk);
  }

  return chunks.join("-");
}

export function normalizeGroupCode(input: string) {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/(.{4})/g, "$1-")
    .replace(/-$/g, "");
}

export function isValidGroupCode(input: string) {
  if (input.length > MAX_GROUP_CODE_INPUT_LENGTH || !/^[A-Za-z0-9\s-]+$/.test(input)) {
    return false;
  }

  const normalized = normalizeGroupCode(input);
  const compact = normalized.replaceAll("-", "");
  return (
    compact.length === DEFAULT_GROUP_CODE_GROUPS * DEFAULT_GROUP_CODE_GROUP_LENGTH &&
    [...compact].every((char) => GROUP_CODE_ALPHABET.includes(char))
  );
}
