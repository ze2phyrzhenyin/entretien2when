export type CandidateSlotView = {
  id: string;
  startAt: string;
  endAt: string;
  disabled: boolean;
  initiallySelected?: boolean;
};

export type AdminSlotView = {
  id: string;
  startAt: string;
  endAt: string;
  status: "OPEN" | "CLOSED" | "LOCKED" | "SCHEDULED";
  availableCandidateCount: number;
  lockReasonInternal?: string | null;
  candidates?: Array<{
    id: string;
    name: string;
    email: string;
  }>;
};

export type TimeRangeItem = {
  id: string;
  startAt: string;
  endAt: string;
};
