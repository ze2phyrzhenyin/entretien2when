import { describe, expect, it } from "vitest";
import { buildAppointmentEmailContext } from "@/lib/mail/appointment-email-context";

describe("appointment email time context", () => {
  it("uses the interview group's timezone instead of always labeling Beijing time", () => {
    const context = buildAppointmentEmailContext(
      {
        startAt: new Date("2026-03-29T00:00:00.000Z"),
        endAt: new Date("2026-03-29T01:00:00.000Z")
      },
      "Europe/Paris"
    );

    expect(context.appointmentTime).toContain("01:00-03:00");
    expect(context.appointmentTime).toContain("Europe/Paris");
    expect(context.appointmentTime).not.toContain("北京时间");
  });
});
