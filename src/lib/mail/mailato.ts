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
  recipient?: MailatoRecipient;
  recipients?: MailatoRecipient[];
  cc?: MailatoRecipient[];
  bcc?: MailatoRecipient[];
  subject: string;
  body: string;
  idempotencyKey?: string;
  auditId?: string;
  timeoutMs?: number;
  attachments?: Array<{
    filename: string;
    content: string;
  }>;
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

function commandOutput(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toMailatoError(error: unknown) {
  if (error && typeof error === "object") {
    const maybeOutput = error as { stderr?: unknown; stdout?: unknown; message?: unknown };
    const stderr = commandOutput(maybeOutput.stderr);
    const stdout = commandOutput(maybeOutput.stdout);
    const message = commandOutput(maybeOutput.message);
    return new Error(stderr || stdout || message || "Mailato command failed.");
  }
  return error;
}

function isMailatoDryRun() {
  const value = process.env.MAILATO_DRY_RUN?.toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function getMailatoCommand() {
  return process.env.MAILATO_COMMAND || "mailato";
}

export function buildMailatoArgs({
  recipient,
  recipients,
  cc,
  bcc,
  subject,
  bodyFile,
  idempotencyKey,
  auditId,
  attachmentFiles,
  dryRun
}: {
  recipient?: MailatoRecipient;
  recipients?: MailatoRecipient[];
  cc?: MailatoRecipient[];
  bcc?: MailatoRecipient[];
  subject: string;
  bodyFile: string;
  idempotencyKey?: string;
  auditId?: string;
  attachmentFiles?: string[];
  dryRun: boolean;
}) {
  const toRecipients = recipients?.length ? recipients : recipient ? [recipient] : [];
  if (toRecipients.length === 0) {
    throw new Error("Mailato requires at least one recipient.");
  }

  const args = ["send"];

  for (const toRecipient of toRecipients) {
    args.push(
      "--to",
      toRecipient.name ? `${toRecipient.name} <${toRecipient.email}>` : toRecipient.email
    );
  }

  args.push("--subject", subject, "--body-file", bodyFile);

  for (const ccRecipient of cc ?? []) {
    args.push(
      "--cc",
      ccRecipient.name ? `${ccRecipient.name} <${ccRecipient.email}>` : ccRecipient.email
    );
  }

  for (const bccRecipient of bcc ?? []) {
    args.push(
      "--bcc",
      bccRecipient.name ? `${bccRecipient.name} <${bccRecipient.email}>` : bccRecipient.email
    );
  }

  if (idempotencyKey) {
    args.push("--idempotency-key", idempotencyKey);
  }

  if (auditId) {
    args.push("--audit-id", auditId);
  }

  for (const attachmentFile of attachmentFiles ?? []) {
    args.push("--file", attachmentFile);
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
    const attachmentFiles = [];
    for (const attachment of input.attachments ?? []) {
      const filename = path.basename(attachment.filename).replace(/[^A-Za-z0-9._-]/g, "_");
      if (!filename || filename === "." || filename === "..") {
        throw new Error("Mailato attachment filename is invalid.");
      }
      const attachmentFile = path.join(tempDir, filename);
      await writeFile(attachmentFile, attachment.content, "utf8");
      attachmentFiles.push(attachmentFile);
    }
    let stdout: string;
    try {
      ({ stdout } = await execFileAsync(
        getMailatoCommand(),
        buildMailatoArgs({
          recipient: input.recipient,
          recipients: input.recipients,
          cc: input.cc,
          bcc: input.bcc,
          subject: input.subject,
          bodyFile,
          idempotencyKey: input.idempotencyKey,
          auditId: input.auditId,
          attachmentFiles,
          dryRun
        }),
        {
          timeout: input.timeoutMs ?? 90_000,
          maxBuffer: 1024 * 1024
        }
      ));
    } catch (error) {
      throw toMailatoError(error);
    }

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
