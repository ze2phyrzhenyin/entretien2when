type CandidateSelfSource = {
  id: string;
  name: string;
  email: string;
  status: string;
  activeSubmission?: {
    id: string;
    versionNo: number;
    candidateNote: string | null;
    slots: Array<{
      slot: {
        id: string;
        startAt: Date;
        endAt: Date;
        status: string;
      };
    }>;
  } | null;
  appointments?: Array<{
    id: string;
    startAt: Date;
    endAt: Date;
    status: string;
    candidateVisibleMessage: string | null;
    meetingLocation: string | null;
  }>;
};

export function toCandidateSelfDTO(candidate: CandidateSelfSource) {
  return {
    id: candidate.id,
    name: candidate.name,
    email: candidate.email,
    status: candidate.status,
    activeSubmission: candidate.activeSubmission
      ? {
          id: candidate.activeSubmission.id,
          versionNo: candidate.activeSubmission.versionNo,
          candidateNote: candidate.activeSubmission.candidateNote,
          slots: candidate.activeSubmission.slots.map(({ slot }) => ({
            id: slot.id,
            startAt: slot.startAt.toISOString(),
            endAt: slot.endAt.toISOString(),
            status: slot.status
          }))
        }
      : null,
    appointments:
      candidate.appointments?.map((appointment) => ({
        id: appointment.id,
        startAt: appointment.startAt.toISOString(),
        endAt: appointment.endAt.toISOString(),
        status: appointment.status,
        candidateVisibleMessage: appointment.candidateVisibleMessage,
        meetingLocation: appointment.meetingLocation
      })) ?? []
  };
}
