import { describe, expect, it } from "vitest";
import {
  buildLocalizedCandidateEmailRecipientPlan,
  selectCandidateEmailLocalizedContent
} from "@/lib/mail/candidate-email-localization";

describe("candidate email recipient localization", () => {
  const content = {
    "zh-CN": { subject: "中文主题", body: "中文正文 {appointmentTime}" },
    en: { subject: "English subject", body: "English body {appointmentTime}" }
  } as const;

  it("selects independent subject and body drafts for a mixed-locale batch", () => {
    expect(selectCandidateEmailLocalizedContent("zh-CN", content)).toEqual(content["zh-CN"]);
    expect(selectCandidateEmailLocalizedContent("en", content)).toEqual(content.en);
  });

  it("plans body, date context, and delivery locale per recipient in one batch", () => {
    const appointment = {
      startAt: new Date("2026-08-10T08:00:00.000Z"),
      endAt: new Date("2026-08-10T09:00:00.000Z"),
      meetingLocation: "Room 1"
    };
    const chinese = buildLocalizedCandidateEmailRecipientPlan({
      preferredLocale: "zh-CN",
      appointment,
      timezone: "Europe/Paris",
      content
    });
    const english = buildLocalizedCandidateEmailRecipientPlan({
      preferredLocale: "en",
      appointment,
      timezone: "Europe/Paris",
      content
    });

    expect(chinese).toMatchObject({
      locale: "zh-CN",
      subject: "中文主题",
      bodyTemplate: "中文正文 {appointmentTime}"
    });
    expect(english).toMatchObject({
      locale: "en",
      subject: "English subject",
      bodyTemplate: "English body {appointmentTime}"
    });
    expect(chinese.templateValues.appointmentTime).toContain("Europe/Paris");
    expect(english.templateValues.appointmentTime).toContain("Europe/Paris");
    expect(chinese.templateValues.appointmentTime).not.toBe(english.templateValues.appointmentTime);
  });
});
