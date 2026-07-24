import { z } from "zod";
import {
  isValidGroupCode,
  MAX_GROUP_CODE_INPUT_LENGTH,
  normalizeGroupCode
} from "@/lib/group-code/generate";

export const cuidSchema = z.string().min(8);

export const groupCodeSchema = z
  .string()
  .trim()
  .min(1, "请输入面试组编号")
  .max(MAX_GROUP_CODE_INPUT_LENGTH, "面试组编号格式不正确")
  .refine(isValidGroupCode, "请输入完整、有效的面试组编号")
  .transform((value) => normalizeGroupCode(value));

export const emailSchema = z
  .string()
  .trim()
  .max(254, "邮箱地址过长")
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
