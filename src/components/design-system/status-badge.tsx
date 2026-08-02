"use client";

import type {
  AppointmentStatus,
  CandidateStatus,
  CandidateSubmissionStatus,
  InterviewGroupStatus
} from "@prisma/client";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { MessageKey } from "@/i18n/catalogs";
import { useLocale } from "@/i18n/locale-provider";
import {
  appointmentStatusLabel,
  candidateStatusLabel,
  candidateSubmissionStatusLabel,
  interviewGroupStatusLabel
} from "@/lib/status-labels";

type StatusBadgeProps =
  | { kind: "candidate"; status: CandidateStatus; className?: string }
  | { kind: "submission"; status: CandidateSubmissionStatus; className?: string }
  | { kind: "appointment"; status: AppointmentStatus; className?: string }
  | { kind: "group"; status: InterviewGroupStatus; className?: string }
  | {
      kind: "slot";
      status: "OPEN" | "CLOSED" | "LOCKED" | "AVAILABLE" | "UNAVAILABLE";
      className?: string;
    }
  | { kind: "custom"; label: string; tone?: BadgeTone; className?: string };

const candidateTone: Record<CandidateStatus, BadgeTone> = {
  SUBMITTED: "primary",
  PENDING_REVIEW: "warning",
  SCHEDULED: "scheduled",
  COMPLETED: "success",
  CANCELLED: "neutral"
};

const submissionTone: Record<CandidateSubmissionStatus, BadgeTone> = {
  ACTIVE: "success",
  PENDING_REVIEW: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  SUPERSEDED: "neutral"
};

const appointmentTone: Record<AppointmentStatus, BadgeTone> = {
  SCHEDULED: "scheduled",
  CANCELLED: "neutral",
  COMPLETED: "success",
  NO_SHOW: "danger"
};

const groupTone: Record<InterviewGroupStatus, BadgeTone> = {
  DRAFT: "neutral",
  OPEN: "success",
  CLOSED: "warning",
  ARCHIVED: "neutral"
};

const slotTone: Record<"OPEN" | "CLOSED" | "LOCKED" | "AVAILABLE" | "UNAVAILABLE", BadgeTone> = {
  OPEN: "success",
  CLOSED: "neutral",
  LOCKED: "locked",
  AVAILABLE: "primary",
  UNAVAILABLE: "neutral"
};

const slotLabel: Record<"OPEN" | "CLOSED" | "LOCKED" | "AVAILABLE" | "UNAVAILABLE", MessageKey> = {
  OPEN: "legacy.open.c14c915d",
  CLOSED: "legacy.close.3fd47edc",
  LOCKED: "legacy.locked.56cee909",
  AVAILABLE: "legacy.available.4d99c976",
  UNAVAILABLE: "legacy.not_optional.6087d10e"
};

export function StatusBadge(props: StatusBadgeProps) {
  const { t } = useLocale();
  if (props.kind === "custom") {
    return (
      <Badge tone={props.tone ?? "neutral"} className={props.className}>
        {props.label}
      </Badge>
    );
  }

  if (props.kind === "candidate") {
    return (
      <Badge tone={candidateTone[props.status]} className={props.className}>
        {t(candidateStatusLabel[props.status])}
      </Badge>
    );
  }

  if (props.kind === "submission") {
    return (
      <Badge tone={submissionTone[props.status]} className={props.className}>
        {t(candidateSubmissionStatusLabel[props.status])}
      </Badge>
    );
  }

  if (props.kind === "appointment") {
    return (
      <Badge tone={appointmentTone[props.status]} className={props.className}>
        {t(appointmentStatusLabel[props.status])}
      </Badge>
    );
  }

  if (props.kind === "group") {
    return (
      <Badge tone={groupTone[props.status]} className={props.className}>
        {t(interviewGroupStatusLabel[props.status])}
      </Badge>
    );
  }

  return (
    <Badge tone={slotTone[props.status]} className={props.className}>
      {t(slotLabel[props.status])}
    </Badge>
  );
}
