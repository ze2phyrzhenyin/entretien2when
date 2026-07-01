import { generateGroupCode } from "@/lib/group-code/generate";
import { prisma } from "@/lib/db/prisma";

export async function generateUniqueGroupCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const groupCode = generateGroupCode();
    const existing = await prisma.interviewGroup.findUnique({
      where: { groupCode },
      select: { id: true }
    });

    if (!existing) {
      return groupCode;
    }
  }

  throw new Error("无法生成唯一面试组编号，请重试。");
}
