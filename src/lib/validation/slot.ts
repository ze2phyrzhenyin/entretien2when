import { z } from "zod";

export const batchGenerateSlotsSchema = z
  .object({
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请选择开始日期"),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请选择结束日期"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "请选择开始时间"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "请选择结束时间"),
    weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1, "至少选择一个星期")
  })
  .refine((value) => value.endTime > value.startTime, {
    path: ["endTime"],
    message: "结束时间必须晚于开始时间"
  });
