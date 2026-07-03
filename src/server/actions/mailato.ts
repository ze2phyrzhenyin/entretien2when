"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { AdminRole, AuditActorType } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { sendMailatoEmail } from "@/lib/mail/mailato";
import { formValue } from "@/lib/validation/common";
import { mailatoEmailActionSchema } from "@/lib/validation/email";

function redirectWithMailatoStatus(params: {
  result: "sent" | "error" | "invalid";
  dryRun?: boolean;
}): never {
  const url = new URL("http://local/admin/mailato");
  url.searchParams.set("mailato", params.result);
  if (params.dryRun) {
    url.searchParams.set("dryRun", "1");
  }
  redirect(`${url.pathname}${url.search}`);
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.split("\n")[0]?.slice(0, 240) || "Mailato 发送失败";
  }
  return "Mailato 发送失败";
}

export async function sendMailatoAdminEmailAction(formData: FormData) {
  const admin = await requireAdmin();
  if (admin.role !== AdminRole.SUPER_ADMIN) {
    throw new Error("只有超级管理员可以使用邮件发送功能。");
  }

  const parsed = mailatoEmailActionSchema.safeParse({
    toEmails: formValue(formData, "toEmails"),
    ccEmails: formValue(formData, "ccEmails"),
    bccEmails: formValue(formData, "bccEmails"),
    subject: formValue(formData, "subject"),
    body: formValue(formData, "body"),
    confirmSend: formValue(formData, "confirmSend")
  });

  if (!parsed.success) {
    redirectWithMailatoStatus({ result: "invalid" });
  }

  const input = parsed.data;
  const mailId = randomUUID();

  try {
    const result = await sendMailatoEmail({
      recipients: input.toEmails.map((email) => ({ email })),
      cc: input.ccEmails.map((email) => ({ email })),
      bcc: input.bccEmails.map((email) => ({ email })),
      subject: input.subject,
      body: input.body,
      auditId: `admin-mailato:${mailId}`
    });

    await prisma.auditLog.create({
      data: {
        actorType: AuditActorType.ADMIN,
        actorAdminId: admin.id,
        action: "admin.send_mailato_email",
        entityType: "MailatoEmail",
        entityId: mailId,
        afterData: {
          toEmails: input.toEmails,
          ccEmails: input.ccEmails,
          bccCount: input.bccEmails.length,
          subject: input.subject,
          status: result.status,
          emailId: result.emailId,
          dryRun: result.dryRun
        }
      }
    });

    redirectWithMailatoStatus({
      result: "sent",
      dryRun: result.dryRun
    });
  } catch (error) {
    await prisma.auditLog.create({
      data: {
        actorType: AuditActorType.ADMIN,
        actorAdminId: admin.id,
        action: "admin.send_mailato_email",
        entityType: "MailatoEmail",
        entityId: mailId,
        afterData: {
          toEmails: input.toEmails,
          ccEmails: input.ccEmails,
          bccCount: input.bccEmails.length,
          subject: input.subject,
          status: "failure",
          errorMessage: safeErrorMessage(error)
        }
      }
    });

    redirectWithMailatoStatus({ result: "error" });
  }
}
