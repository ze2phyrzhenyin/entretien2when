import { normalizeLocale, type AppLocale } from "@/i18n/config";

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

const englishEmailSignature = "Sincerely,\n\nZhaoyang SUI\n泓泽数商科技（深圳）有限公司";

export const englishCandidateEmailTemplates = [
  {
    key: "interview_notice",
    label: "Interview details",
    subject: "{groupName} interview details",
    body: `Hello {name},\n\nHere are the interview details for {groupName}.\n\nPlease review the interview time and join on time.\n\n${englishEmailSignature}`
  },
  {
    key: "appointment_confirmed",
    label: "Confirmed interview",
    subject: "{groupName} interview confirmed",
    body: `Hello {name},\n\nYour interview for {groupName} has been confirmed.\n\nInterview time: {appointmentTime}\nLocation/link: {meetingLocation}\n\n{candidateMessage}\n\nPlease join on time.\n\n${englishEmailSignature}`
  },
  {
    key: "appointment_reminder",
    label: "Interview reminder",
    subject: "{groupName} interview reminder",
    body: `Hello {name},\n\nThis is a reminder about your interview for {groupName}. Reply to this email if you need any additional information.\n\n${englishEmailSignature}`
  },
  {
    key: "reschedule_notice",
    label: "Rescheduling request",
    subject: "{groupName} interview rescheduling",
    body: `Hello {name},\n\nWe need to confirm a new interview time for {groupName}. Please reply with the times that work for you.\n\n${englishEmailSignature}`
  },
  {
    key: "custom_notice",
    label: "Custom notice",
    subject: "{groupName} notice",
    body: `Hello {name},\n\nThis is a notice about {groupName}.\n\n${englishEmailSignature}`
  }
] satisfies CandidateEmailTemplate[];

export function candidateEmailTemplatesFor(locale: AppLocale) {
  return normalizeLocale(locale) === "en"
    ? englishCandidateEmailTemplates
    : candidateEmailTemplates;
}
