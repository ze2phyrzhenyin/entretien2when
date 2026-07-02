#!/usr/bin/env node

const args = process.argv.slice(2);

if (args.includes("--version")) {
  process.stdout.write("mailato 0.0.0-test\n");
  process.exit(0);
}

if (args[0] !== "send") {
  process.stderr.write("fake-mailato only supports send in tests\n");
  process.exit(2);
}

const auditIdIndex = args.indexOf("--audit-id");
const status = args.includes("--dry-run-json") ? "preview" : "sent";
const auditId = auditIdIndex >= 0 ? args[auditIdIndex + 1] : "test";

process.stdout.write(
  `${JSON.stringify({
    status,
    email_id: `fake-${auditId}`
  })}\n`
);
