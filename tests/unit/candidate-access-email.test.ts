import { describe, expect, it } from "vitest";
import { buildCandidateAccessEmail } from "@/lib/mail/candidate-access-email";

describe("candidate access email locale and timezone", () => {
  it("includes the interview-group timezone in English expiry copy", () => {
    const email = buildCandidateAccessEmail({
      groupName: "Paris interviews",
      candidateName: "Alex",
      accessUrl: "https://example.test/access",
      expiresAt: new Date("2026-08-10T08:00:00.000Z"),
      timezone: "Europe/Paris",
      locale: "en"
    });

    expect(email.subject).toContain("access link");
    expect(email.body).toContain("Europe/Paris");
    expect(email.body).toContain("10:00");
  });
});
