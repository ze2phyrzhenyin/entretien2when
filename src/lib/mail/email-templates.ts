export type CandidateEmailTemplate = {
  key: string;
  label: string;
  subject: string;
  body: string;
};

const defaultEmailSignature = "此致\n\nZhaoyang SUI（隋朝阳）\n泓泽数商科技（深圳）有限公司";

export const defaultCandidateEmailTemplate = {
  key: "interview_notice",
  label: "面试安排通知",
  subject: "{groupName} 面试安排通知",
  body: `你好 {name}，\n\n这是 {groupName} 的面试安排通知。\n\n请查看面试时间，并按要求准时参加。\n\n${defaultEmailSignature}`
} satisfies CandidateEmailTemplate;

export const appointmentConfirmedEmailTemplate = {
  key: "appointment_confirmed",
  label: "已确认面试通知",
  subject: "{groupName} 面试安排通知",
  body: `你好 {name}，\n\n这是 {groupName} 的面试安排通知。\n\n面试时间：{appointmentTime}\n会议地点/链接：{meetingLocation}\n\n{candidateMessage}\n\n请按要求准时参加。\n\n${defaultEmailSignature}`
} satisfies CandidateEmailTemplate;

export const candidateEmailTemplates = [
  defaultCandidateEmailTemplate,
  appointmentConfirmedEmailTemplate,
  {
    key: "appointment_reminder",
    label: "面试提醒",
    subject: "{groupName} 面试提醒",
    body: `你好 {name}，\n\n请关注 {groupName} 的面试安排。如需补充信息，请及时回复本邮件。\n\n${defaultEmailSignature}`
  },
  {
    key: "reschedule_notice",
    label: "时间调整沟通",
    subject: "{groupName} 面试时间沟通",
    body: `你好 {name}，\n\n关于 {groupName} 的面试时间，我们需要和你确认新的安排。请收到邮件后回复你的可配合时间。\n\n${defaultEmailSignature}`
  },
  {
    key: "custom_notice",
    label: "自定义通知",
    subject: "{groupName} 通知",
    body: `你好 {name}，\n\n这是 {groupName} 的通知。\n\n${defaultEmailSignature}`
  }
] satisfies CandidateEmailTemplate[];
