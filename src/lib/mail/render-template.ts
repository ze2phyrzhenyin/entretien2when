export type CandidateEmailTemplateValues = {
  candidateName: string;
  candidateEmail: string;
  groupName: string;
};

export function renderCandidateEmailTemplate(
  template: string,
  values: CandidateEmailTemplateValues
) {
  return template
    .replaceAll("{name}", values.candidateName)
    .replaceAll("{email}", values.candidateEmail)
    .replaceAll("{groupName}", values.groupName);
}
