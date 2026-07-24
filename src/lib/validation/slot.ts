import { z } from "zod";
import { cuidSchema } from "@/lib/validation/common";

export const MAX_SLOT_GENERATION_DAYS = 90;
export const MAX_SLOT_GENERATION_ROWS = 2_000;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;
const localTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "请选择有效的 24 小时时间");

function parseCalendarDate(value: string) {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function isSlotGenerationWithinLimits(days: number, slotsPerDay: number) {
  if (
    !Number.isSafeInteger(days) ||
    !Number.isSafeInteger(slotsPerDay) ||
    days < 1 ||
    slotsPerDay < 1 ||
    days > MAX_SLOT_GENERATION_DAYS
  ) {
    return false;
  }

  return days * slotsPerDay <= MAX_SLOT_GENERATION_ROWS;
}

export const batchGenerateSlotsSchema = z
  .object({
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请选择开始日期"),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请选择结束日期"),
    startTime: localTimeSchema,
    endTime: localTimeSchema
  })
  .superRefine((value, context) => {
    const startDate = parseCalendarDate(value.dateFrom);
    const endDate = parseCalendarDate(value.dateTo);

    if (!startDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateFrom"],
        message: "请选择有效的开始日期"
      });
    }
    if (!endDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateTo"],
        message: "请选择有效的结束日期"
      });
    }
    if (startDate && endDate) {
      const days = Math.floor((endDate.getTime() - startDate.getTime()) / MILLISECONDS_PER_DAY) + 1;
      if (days < 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dateTo"],
          message: "结束日期不能早于开始日期"
        });
      } else if (days > MAX_SLOT_GENERATION_DAYS) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dateTo"],
          message: `一次最多生成 ${MAX_SLOT_GENERATION_DAYS} 天的开放时间`
        });
      }
    }

    if (value.endTime <= value.startTime) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "结束时间必须晚于开始时间"
      });
    }
  });

export const batchDeleteSlotsSchema = z.object({
  slotIds: z
    .array(cuidSchema)
    .min(1, "请选择至少一个开放时间")
    .max(200, "一次最多删除 200 个开放时间"),
  confirmDelete: z.literal("yes", {
    errorMap: () => ({ message: "删除前请确认" })
  })
});

export const clearSlotsSchema = z.object({
  confirmDelete: z.literal("yes", {
    errorMap: () => ({ message: "清空前请确认" })
  })
});
