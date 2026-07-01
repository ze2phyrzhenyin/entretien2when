export type CandidateSlotView = {
  id: string;
  dateLabel: string;
  timeLabel: string;
  disabled: boolean;
  initiallySelected?: boolean;
};

export type AdminSlotView = {
  id: string;
  timeLabel: string;
  status: "OPEN" | "CLOSED" | "LOCKED" | "SCHEDULED";
  availableCandidateCount: number;
  lockReasonInternal?: string | null;
  candidates?: Array<{
    id: string;
    name: string;
    email: string;
  }>;
};
