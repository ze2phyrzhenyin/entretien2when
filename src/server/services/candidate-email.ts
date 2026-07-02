import { CandidateEmailDeliveryStatus } from "@prisma/client";
import {
  renderCandidateEmailTemplate,
  type CandidateEmailTemplateValues
} from "@/lib/mail/render-template";
import { sendMailatoEmail } from "@/lib/mail/mailato";
import { prisma } from "@/lib/db/prisma";

type EmailGroup = {
  id: string;
  name: string;
};

type EmailCandidate = {
  id: string;
  name: string;
  email: string;
};

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.split("\n")[0]?.slice(0, 240) || "发送失败";
  }
  return "发送失败";
}

export async function attemptCandidateEmailDelivery(input: {
  adminId: string;
  group: EmailGroup;
  candidate: EmailCandidate;
  batchId: string;
  templateKey?: string | null;
  subject: string;
  bodyTemplate: string;
  templateValues?: Partial<
    Pick<CandidateEmailTemplateValues, "appointmentTime" | "meetingLocation" | "candidateMessage">
  >;
  retriedFromId?: string | null;
}) {
  const templateValues: CandidateEmailTemplateValues = {
    candidateName: input.candidate.name,
    candidateEmail: input.candidate.email,
    groupName: input.group.name,
    appointmentTime: input.templateValues?.appointmentTime ?? "尚未安排",
    meetingLocation: input.templateValues?.meetingLocation ?? "未填写",
    candidateMessage: input.templateValues?.candidateMessage ?? ""
  };

  try {
    const result = await sendMailatoEmail({
      recipient: {
        email: input.candidate.email,
        name: input.candidate.name
      },
      subject: renderCandidateEmailTemplate(input.subject, templateValues),
      body: renderCandidateEmailTemplate(input.bodyTemplate, templateValues),
      auditId: `${input.batchId}:${input.candidate.id}`
    });
    const delivery = await prisma.candidateEmailDelivery.create({
      data: {
        groupId: input.group.id,
        candidateId: input.candidate.id,
        sentByAdminId: input.adminId,
        batchId: input.batchId,
        templateKey: input.templateKey || null,
        subject: input.subject,
        bodyTemplate: input.bodyTemplate,
        candidateNameSnapshot: input.candidate.name,
        recipientEmailSnapshot: input.candidate.email,
        status:
          result.status === "sent"
            ? CandidateEmailDeliveryStatus.SENT
            : CandidateEmailDeliveryStatus.PREVIEW,
        providerMessageId: result.emailId ?? null,
        retriedFromId: input.retriedFromId || null
      }
    });

    return {
      deliveryId: delivery.id,
      candidateId: input.candidate.id,
      status: result.status,
      emailId: result.emailId ?? null,
      error: null
    };
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    const delivery = await prisma.candidateEmailDelivery.create({
      data: {
        groupId: input.group.id,
        candidateId: input.candidate.id,
        sentByAdminId: input.adminId,
        batchId: input.batchId,
        templateKey: input.templateKey || null,
        subject: input.subject,
        bodyTemplate: input.bodyTemplate,
        candidateNameSnapshot: input.candidate.name,
        recipientEmailSnapshot: input.candidate.email,
        status: CandidateEmailDeliveryStatus.FAILED,
        errorMessage,
        retriedFromId: input.retriedFromId || null
      }
    });

    return {
      deliveryId: delivery.id,
      candidateId: input.candidate.id,
      status: "failure" as const,
      emailId: null,
      error: errorMessage
    };
  }
}
