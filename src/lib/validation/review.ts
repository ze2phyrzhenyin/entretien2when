import { z } from "zod";

export const reviewSubmissionSchema = z.object({
  reviewComment: z.string().trim().max(1000, "审核意见最多 1000 个字符").optional()
});
