export type CandidateEmailTemplate = {
  key: string;
  label: string;
  subject: string;
  body: string;
};

export const defaultCandidateEmailTemplate = {
  key: "interview_notice",
  label: "面试安排通知",
  subject: "{groupName} 面试安排通知",
  body: "你好 {name}，\n\n这里是 {groupName} 的面试安排通知。\n\n请查看你的面试时间，并按要求准时参加。\n\n谢谢。"
} satisfies CandidateEmailTemplate;

export const candidateEmailTemplates = [
  defaultCandidateEmailTemplate,
  {
    key: "appointment_reminder",
    label: "面试提醒",
    subject: "{groupName} 面试提醒",
    body: "你好 {name}，\n\n提醒你关注 {groupName} 的面试安排。如需补充信息，请及时回复本邮件。\n\n谢谢。"
  },
  {
    key: "reschedule_notice",
    label: "改期沟通",
    subject: "{groupName} 面试时间沟通",
    body: "你好 {name}，\n\n关于 {groupName} 的面试时间，我们需要和你确认新的安排。请收到邮件后回复你的可配合时间。\n\n谢谢。"
  },
  {
    key: "custom_notice",
    label: "自定义通知",
    subject: "{groupName} 通知",
    body: "你好 {name}，\n\n这里是 {groupName} 的通知。\n\n谢谢。"
  }
] satisfies CandidateEmailTemplate[];
