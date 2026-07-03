import type {
  AppointmentStatus,
  CandidateStatus,
  CandidateSubmissionStatus,
  CandidateSubmissionType,
  InterviewGroupStatus
} from "@prisma/client";

export const interviewGroupStatusLabel: Record<InterviewGroupStatus, string> = {
  DRAFT: "草稿",
  OPEN: "开放",
  CLOSED: "关闭",
  ARCHIVED: "归档"
};

export const candidateStatusLabel: Record<CandidateStatus, string> = {
  SUBMITTED: "已提交",
  PENDING_REVIEW: "修改待审",
  SCHEDULED: "已安排面试",
  COMPLETED: "已完成",
  CANCELLED: "已取消"
};

export const candidateSubmissionStatusLabel: Record<CandidateSubmissionStatus, string> = {
  ACTIVE: "当前有效",
  PENDING_REVIEW: "待审核",
  APPROVED: "已通过",
  REJECTED: "已拒绝",
  SUPERSEDED: "已替换"
};

export const candidateSubmissionTypeLabel: Record<CandidateSubmissionType, string> = {
  INITIAL: "首次提交",
  MODIFICATION: "修改申请"
};

export const appointmentStatusLabel: Record<AppointmentStatus, string> = {
  SCHEDULED: "已安排",
  CANCELLED: "已取消",
  COMPLETED: "已完成",
  NO_SHOW: "未到场"
};
