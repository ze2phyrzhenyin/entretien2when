import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type MailatoRecipient = {
  email: string;
  name?: string | null;
};

export type MailatoSendInput = {
  recipient: MailatoRecipient;
  subject: string;
  body: string;
  auditId?: string;
};

export type MailatoSendResult = {
  status: "sent" | "preview";
  emailId?: string | null;
  dryRun: boolean;
};

type MailatoJsonResponse = {
  status?: string;
  email_id?: string | null;
};

export function isMailatoDryRun() {
  const value = process.env.MAILATO_DRY_RUN?.toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function getMailatoCommand() {
  return process.env.MAILATO_COMMAND || "mailato";
}

export function buildMailatoArgs({
  recipient,
  subject,
  bodyFile,
  auditId,
  dryRun
}: {
  recipient: MailatoRecipient;
  subject: string;
  bodyFile: string;
  auditId?: string;
  dryRun: boolean;
}) {
  const args = [
    "send",
    "--to",
    recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email,
    "--subject",
    subject,
    "--body-file",
    bodyFile
  ];

  if (auditId) {
    args.push("--audit-id", auditId);
  }

  if (dryRun) {
    args.push("--dry-run-json");
  } else {
    args.push("--json", "--yes");
  }

  return args;
}

export async function sendMailatoEmail(input: MailatoSendInput): Promise<MailatoSendResult> {
  const dryRun = isMailatoDryRun();
  const tempDir = await mkdtemp(path.join(tmpdir(), "interview-mailato-"));
  const bodyFile = path.join(tempDir, "body.txt");

  try {
    await writeFile(bodyFile, input.body, "utf8");
    const { stdout } = await execFileAsync(
      getMailatoCommand(),
      buildMailatoArgs({
        recipient: input.recipient,
        subject: input.subject,
        bodyFile,
        auditId: input.auditId,
        dryRun
      }),
      {
        timeout: 90_000,
        maxBuffer: 1024 * 1024
      }
    );

    const parsed = JSON.parse(stdout) as MailatoJsonResponse;
    return {
      status: parsed.status === "sent" ? "sent" : "preview",
      emailId: parsed.email_id ?? null,
      dryRun
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
