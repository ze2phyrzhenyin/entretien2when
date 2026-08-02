import { describe, expect, it } from "vitest";
import {
  catalogs,
  createTranslator,
  selectPluralValue,
  translateKnownSource,
  translateMessage
} from "@/i18n/catalogs";
import {
  defaultUiLocale,
  legacyContentLocale,
  localeCookieOptions,
  normalizeLocale,
  resolveUiLocale
} from "@/i18n/config";
import { candidateEmailTemplatesFor } from "@/lib/mail/email-templates";
import {
  hasConfirmedAppointment,
  resolveComposerTemplates,
  type CandidateEmailTarget
} from "@/components/admin/candidate-email-composer-model";

const placeholderPattern = /\{([A-Za-z_][A-Za-z0-9_.-]*)\}/g;
const reviewedLegalEntityName = "泓泽数商科技（深圳）有限公司";

function removeReviewedLegalEntityName(value: string) {
  return value.replaceAll(reviewedLegalEntityName, "");
}

function placeholders(value: string) {
  return [...value.matchAll(placeholderPattern)].map((match) => match[1]).sort();
}

describe("i18n contract", () => {
  it("keeps catalog keys and placeholders aligned", () => {
    expect(Object.keys(catalogs.en).sort()).toEqual(Object.keys(catalogs["zh-CN"]).sort());
    for (const key of Object.keys(catalogs["zh-CN"]) as Array<keyof (typeof catalogs)["zh-CN"]>) {
      expect(placeholders(catalogs.en[key]), key).toEqual(placeholders(catalogs["zh-CN"][key]));
    }
  });

  it("separates the anonymous UI default from the legacy content fallback", () => {
    expect(defaultUiLocale).toBe("en");
    expect(legacyContentLocale).toBe("zh-CN");
    expect(resolveUiLocale(undefined)).toBe("en");
    expect(resolveUiLocale("fr-FR")).toBe("en");
    expect(resolveUiLocale("zh-Hans-CN")).toBe("zh-CN");
    expect(normalizeLocale("en-GB")).toBe("en");
    expect(normalizeLocale("zh-Hans-CN")).toBe("zh-CN");
    expect(normalizeLocale("fr-FR")).toBe("zh-CN");
    expect(normalizeLocale(undefined)).toBe("zh-CN");
  });

  it("uses a base-path-scoped, year-long locale cookie", () => {
    expect(localeCookieOptions("/when2entretien")).toMatchObject({
      path: "/when2entretien",
      sameSite: "lax",
      maxAge: 31_536_000
    });
  });

  it("selects reviewed singular and plural forms", () => {
    const forms = { one: "interview appointment", other: "interview appointments" };
    expect(selectPluralValue("en", 1, forms)).toBe("interview appointment");
    expect(selectPluralValue("en", 2, forms)).toBe("interview appointments");
  });

  it("translates only explicit semantic message keys", () => {
    expect(translateMessage("en", "common.language.switchTo", { language: "English" })).toBe(
      "Switch to English"
    );
    const translate = createTranslator("en");
    expect(translate("legacy.administrator_sign_in.c454c61e")).toBe("Administrator sign in");
    expect(translate("metadata.title")).toBe("Interview scheduling");
  });

  it("translates only reviewed system sources and preserves unknown values", () => {
    expect(translateKnownSource("en", "请输入有效邮箱")).toBe("Please enter a valid email address");
    expect(translateKnownSource("en", "最多 80 个字符")).toBe("Up to 80 characters");
    expect(translateKnownSource("en", "时间粒度必须是数字")).toBe("Slot duration must be a number");
    expect(translateKnownSource("en", "收件人格式无效：姓名")).toBe("Invalid recipient: 姓名");
    expect(translateKnownSource("en", "抄送（CC）格式无效：姓名")).toBe("Invalid CC: 姓名");
    expect(translateKnownSource("en", "密送（BCC）格式无效：姓名")).toBe("Invalid BCC: 姓名");
    expect(translateKnownSource("en", "一次最多填写 50 个收件人")).toBe(
      "Maximum recipient entries: 50"
    );

    const authoredValue = "管理员 wrote 这是一条用户备注";
    expect(translateKnownSource("en", authoredValue)).toBe(authoredValue);
  });

  it("provides reviewed English generated-email defaults without translating authored values", () => {
    const templates = candidateEmailTemplatesFor("en");
    const confirmed = templates.find((template) => template.key === "appointment_confirmed");

    expect(templates).toHaveLength(5);
    expect(confirmed?.subject).toBe("{groupName} interview confirmed");
    expect(confirmed?.body).toContain("Interview time: {appointmentTime}");
    expect(templates.every((template) => template.body.includes(reviewedLegalEntityName))).toBe(
      true
    );
    expect(
      templates.every(
        (template) => !/[\u3400-\u9fff]/u.test(removeReviewedLegalEntityName(template.body))
      )
    ).toBe(true);
    expect(templates.every((template) => !template.body.includes("Hongze Digital"))).toBe(true);
  });

  it("uses a stable appointment flag instead of localized display copy as business state", () => {
    const target = (appointmentTime: string, hasScheduledAppointment: boolean) =>
      ({
        id: "candidate-1",
        name: "Candidate",
        email: "candidate@example.com",
        appointmentTime,
        hasScheduledAppointment
      }) satisfies CandidateEmailTarget;

    expect(hasConfirmedAppointment([target("尚未安排", false)])).toBe(false);
    expect(hasConfirmedAppointment([target("Not scheduled", false)])).toBe(false);
    expect(hasConfirmedAppointment([target("任意展示文本 / any display copy", true)])).toBe(true);
  });

  it("never falls back to Chinese composer defaults for an English candidate", () => {
    const { availableTemplates, initialTemplate } = resolveComposerTemplates("en", [], true);

    expect(initialTemplate.subject).toBe("{groupName} interview confirmed");
    expect(availableTemplates).toHaveLength(5);
    expect(
      availableTemplates.every((template) => template.body.includes(reviewedLegalEntityName))
    ).toBe(true);
    expect(
      availableTemplates.every(
        (template) => !/[\u3400-\u9fff]/u.test(removeReviewedLegalEntityName(template.body))
      )
    ).toBe(true);
  });
});
