import { isValidGroupCode, normalizeGroupCode } from "../src/lib/group-code/generate";

const input = process.argv[2] ?? "";
const normalized = normalizeGroupCode(input);

console.log(JSON.stringify({ input, normalized, valid: isValidGroupCode(input) }, null, 2));
