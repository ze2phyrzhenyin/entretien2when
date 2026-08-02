import type { AppLocale } from "@/i18n/config";
import { formatDateTimeWithTimezone } from "@/lib/date/timezone";

export function buildCandidateAccessEmail({
  groupName,
  candidateName,
  accessUrl,
  expiresAt,
  timezone,
  locale
}: {
  groupName: string;
  candidateName: string;
  accessUrl: string;
  expiresAt: Date;
  timezone: string;
  locale: AppLocale;
}) {
  if (locale === "en") {
    return {
      subject: `[Interview availability] ${groupName} access link`,
      body: [
        `Hello ${candidateName},`,
        "",
        `Use the link below to open “${groupName}” and submit or review your availability.`,
        accessUrl,
        "",
        `The one-time link expires at ${formatDateTimeWithTimezone(expiresAt, timezone, "en")}.`,
        "If you did not request this link, you can ignore this email."
      ].join("\n")
    };
  }
  return {
    subject: `【面试时间】${groupName} 访问链接`,
    body: [
      `${candidateName}，你好：`,
      "",
      `请使用下面的链接进入「${groupName}」并提交或查看你的可用时间。`,
      accessUrl,
      "",
      `链接将在 ${formatDateTimeWithTimezone(expiresAt, timezone, "zh-CN")} 失效，且只能使用一次。`,
      "如果不是你本人请求，可以忽略这封邮件。"
    ].join("\n")
  };
}
