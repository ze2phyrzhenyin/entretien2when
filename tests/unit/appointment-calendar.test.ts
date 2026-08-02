import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAppointmentCalendarLinks,
  buildAppointmentIcs
} from "@/lib/mail/appointment-calendar";

const input = {
  appointmentId: "appointment-1",
  sequence: 2,
  groupName: "产品一面",
  roundName: "第一轮",
  candidateName: "张三",
  startAt: new Date("2026-08-10T08:00:00.000Z"),
  endAt: new Date("2026-08-10T08:30:00.000Z"),
  meetingLocation: "会议室 A, 线上",
  description: "请提前 5 分钟；准备作品集"
};

describe("appointment calendar", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a stable RFC5545 event and cancellation update", () => {
    vi.stubEnv("APP_URL", "https://example.test/when2entretien");
    const request = buildAppointmentIcs(input);
    const cancellation = buildAppointmentIcs({ ...input, sequence: 3, cancelled: true });

    expect(request).toContain("METHOD:REQUEST\r\n");
    expect(request).toContain("UID:appointment-1@example.test\r\n");
    expect(request).toContain("SEQUENCE:2\r\n");
    expect(request).toContain("DTSTART:20260810T080000Z\r\n");
    expect(request).toContain("LOCATION:会议室 A\\, 线上\r\n");
    expect(cancellation).toContain("METHOD:CANCEL\r\n");
    expect(cancellation).toContain("STATUS:CANCELLED\r\n");
    expect(cancellation).toContain("SEQUENCE:3\r\n");
  });

  it("builds Google and Outlook compose links from stored instants", () => {
    const links = buildAppointmentCalendarLinks(input);

    expect(links.google).toContain("calendar.google.com/calendar/render");
    expect(decodeURIComponent(links.google)).toContain("20260810T080000Z/20260810T083000Z");
    expect(links.outlook).toContain("outlook.office.com/calendar/0/deeplink/compose");
    expect(decodeURIComponent(links.outlook)).toContain("2026-08-10T08:00:00.000Z");
  });

  it("marks an English artifact without translating authored calendar content", () => {
    const calendar = buildAppointmentIcs({ ...input, locale: "en" });

    expect(calendar).toContain("PRODID:-//When2Entretien//Interview Scheduler//EN\r\n");
    expect(calendar).toContain("DESCRIPTION:请提前 5 分钟；准备作品集\r\n");
    expect(calendar).toContain("DTSTART:20260810T080000Z\r\n");
  });
});
