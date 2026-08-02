import { describe, expect, it, vi } from "vitest";
import { queueAppointmentNotifications } from "@/server/services/appointment-notification-email";

describe("appointment notification recipient locale policy", () => {
  it("uses the candidate preference for the candidate and the staff locale for interviewers", async () => {
    const now = new Date("2026-08-02T10:00:00.000Z");
    const queued: Array<Record<string, unknown>> = [];
    const client = {
      emailOutbox: {
        upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => {
          queued.push(create);
          return { id: `outbox-${queued.length}` };
        })
      }
    };

    await queueAppointmentNotifications(
      {
        kind: "scheduled",
        appointment: {
          id: "appointment-1",
          startAt: new Date("2026-08-02T10:30:00.000Z"),
          endAt: new Date("2026-08-02T11:00:00.000Z"),
          calendarSequence: 0
        },
        group: {
          id: "group-1",
          name: "Example group",
          timezone: "Europe/Paris"
        },
        candidate: {
          name: "Candidate",
          email: "candidate@example.com",
          locale: "en"
        },
        interviewers: [{ name: "Interviewer", email: "staff@example.com" }],
        staffLocale: "zh-CN",
        now
      },
      client as never
    );

    expect(queued).toHaveLength(2);
    const payloads = queued.map((item) => item.payload as Record<string, unknown>);
    const candidate = payloads.find(
      (payload) => payload.recipientEmail === "candidate@example.com"
    );
    const interviewer = payloads.find((payload) => payload.recipientEmail === "staff@example.com");

    expect(candidate).toMatchObject({ locale: "en" });
    expect(candidate?.subject).toContain("Interview confirmed");
    expect(candidate?.body).toContain("Europe/Paris");
    expect(candidate?.icsContent).toContain("//EN");
    expect(interviewer).toMatchObject({ locale: "zh-CN" });
    expect(interviewer?.subject).toContain("面试安排已确认");
    expect(interviewer?.body).toContain("Europe/Paris");
    expect(interviewer?.icsContent).toContain("//ZH");
  });
});
