import { generateGroupCode } from "../src/lib/group-code/generate";

const count = Number.parseInt(process.argv[2] ?? "1", 10);
const safeCount = Number.isSafeInteger(count) && count > 0 ? count : 1;

for (let index = 0; index < safeCount; index += 1) {
  console.log(generateGroupCode());
}
