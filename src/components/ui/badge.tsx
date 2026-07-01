import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone =
  "neutral" | "success" | "warning" | "danger" | "primary" | "info" | "locked" | "scheduled";

const toneClassName: Record<BadgeTone, string> = {
  neutral: "border-border bg-surface-subtle text-slate-700",
  success: "border-emerald-200 bg-success-soft text-success",
  warning: "border-amber-200 bg-warning-soft text-warning",
  danger: "border-red-200 bg-danger-soft text-danger",
  primary: "border-blue-200 bg-primary-soft text-primary",
  info: "border-sky-200 bg-info-soft text-info",
  locked: "border-orange-200 bg-locked-soft text-locked",
  scheduled: "border-teal-200 bg-scheduled-soft text-scheduled"
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center whitespace-nowrap rounded-md border px-2 text-xs font-medium",
        toneClassName[tone],
        className
      )}
      {...props}
    />
  );
}
