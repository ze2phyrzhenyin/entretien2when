import { z } from "zod";
import { normalizeGroupCode } from "@/lib/group-code/generate";

export const cuidSchema = z.string().min(8);

export const groupCodeSchema = z
  .string()
  .min(1, "请输入面试组编号")
  .transform((value) => normalizeGroupCode(value));

export const emailSchema = z
  .string()
  .trim()
  .email("请输入有效邮箱")
  .transform((value) => value.toLowerCase());

export const requiredTextSchema = (message: string, max = 200) =>
  z.string().trim().min(1, message).max(max, `最多 ${max} 个字符`);

export function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function formValues(formData: FormData, key: string) {
  return formData.getAll(key).filter((value): value is string => typeof value === "string");
}
