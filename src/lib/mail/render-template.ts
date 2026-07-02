export type CandidateEmailTemplateValues = {
  candidateName: string;
  candidateEmail: string;
  groupName: string;
  appointmentTime?: string;
  meetingLocation?: string;
  candidateMessage?: string;
};

export function renderCandidateEmailTemplate(
  template: string,
  values: CandidateEmailTemplateValues
) {
  return template
    .replaceAll("{name}", values.candidateName)
    .replaceAll("{email}", values.candidateEmail)
    .replaceAll("{groupName}", values.groupName)
    .replaceAll("{appointmentTime}", values.appointmentTime ?? "尚未安排")
    .replaceAll("{meetingLocation}", values.meetingLocation ?? "未填写")
    .replaceAll("{candidateMessage}", values.candidateMessage ?? "");
}
