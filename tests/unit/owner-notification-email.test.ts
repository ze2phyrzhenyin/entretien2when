import { describe, expect, it } from "vitest";
import {
  buildOwnerAppointmentNotificationEmail,
  buildOwnerSubmissionNotificationEmail,
  normalizeOwnerNotificationRecipients
} from "@/server/services/owner-notification-email";

const group = {
  id: "group_1",
  name: "商务信息助理电话面试",
  groupCode: "ABCD-EFGH-IJKL-MNPQ-RSTU",
  timezone: "Asia/Shanghai"
};

const candidate = {
  id: "candidate_1",
  name: "测试候选人",
  email: "candidate@example.test"
};

describe("owner notification emails", () => {
  it("normalizes active group-owner recipient emails without a fallback mailbox", () => {
    expect(normalizeOwnerNotificationRecipients(["a@example.com; b@example.com invalid"])).toEqual([
      "a@example.com",
      "b@example.com"
    ]);
    expect(normalizeOwnerNotificationRecipients(["not-an-email"])).toEqual([]);
  });

  it("builds a candidate modification notification without internal-only fields", () => {
    const email = buildOwnerSubmissionNotificationEmail({
      kind: "modification",
      group,
      candidate,
      submissionId: "submission_1",
      slots: [
        {
          startAt: new Date("2026-07-02T02:00:00.000Z"),
          endAt: new Date("2026-07-02T02:07:00.000Z")
        }
      ],
      candidateNote: "上午更方便",
      occurredAt: new Date("2026-07-02T01:00:00.000Z")
    });

    expect(email.subject).toContain("修改申请通知");
    expect(email.body).toContain("候选人提交了可用时间修改申请");
    expect(email.body).toContain("商务信息助理电话面试");
    expect(email.body).toContain("测试候选人 <candidate@example.test>");
    expect(email.body).toContain("2026/07/02 10:00-10:07");
    expect(email.body).toContain("上午更方便");
    expect(email.body).not.toContain("reasonInternal");
    expect(email.body).not.toContain("adminNotes");
  });

  it("builds an appointment notification for scheduled interviews", () => {
    const email = buildOwnerAppointmentNotificationEmail({
      group,
      candidate,
      appointmentId: "appointment_1",
      startAt: new Date("2026-07-02T02:00:00.000Z"),
      endAt: new Date("2026-07-02T02:35:00.000Z"),
      meetingLocation: "腾讯会议 999-591-4078",
      candidateVisibleMessage: "请提前 5 分钟进入会议",
      scheduledByEmail: "admin@example.com",
      occurredAt: new Date("2026-07-02T01:00:00.000Z")
    });

    expect(email.subject).toContain("已安排面试");
    expect(email.body).toContain("面试时间：2026/07/02 10:00-10:35");
    expect(email.body).toContain("腾讯会议 999-591-4078");
    expect(email.body).toContain("admin@example.com");
  });

  it("builds appointment change notifications", () => {
    const rescheduled = buildOwnerAppointmentNotificationEmail({
      kind: "rescheduled",
      group,
      candidate,
      appointmentId: "appointment_1",
      startAt: new Date("2026-07-02T03:00:00.000Z"),
      endAt: new Date("2026-07-02T03:35:00.000Z"),
      scheduledByEmail: "admin@example.com"
    });
    const cancelled = buildOwnerAppointmentNotificationEmail({
      kind: "cancelled",
      group,
      candidate,
      appointmentId: "appointment_1",
      startAt: new Date("2026-07-02T03:00:00.000Z"),
      endAt: new Date("2026-07-02T03:35:00.000Z"),
      scheduledByEmail: "admin@example.com"
    });

    expect(rescheduled.subject).toContain("面试时间已调整");
    expect(rescheduled.body).toContain("管理员调整了正式面试安排");
    expect(cancelled.subject).toContain("面试安排已取消");
    expect(cancelled.body).toContain("管理员取消了正式面试安排");
  });
});
