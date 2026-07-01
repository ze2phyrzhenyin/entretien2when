import type { HTMLAttributes, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, ShieldCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertTone = "info" | "success" | "warning" | "danger" | "privacy" | "admin";

const toneClassName: Record<AlertTone, string> = {
  info: "border-sky-200 bg-info-soft text-slate-800",
  success: "border-emerald-200 bg-success-soft text-slate-800",
  warning: "border-amber-200 bg-warning-soft text-slate-900",
  danger: "border-red-200 bg-danger-soft text-slate-900",
  privacy: "border-blue-200 bg-primary-soft text-slate-800",
  admin: "border-amber-200 bg-warning-soft text-slate-900"
};

const iconClassName: Record<AlertTone, string> = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  privacy: "text-primary",
  admin: "text-warning"
};

const iconByTone: Record<AlertTone, ReactNode> = {
  info: <Info className="h-4 w-4" aria-hidden="true" />,
  success: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
  warning: <TriangleAlert className="h-4 w-4" aria-hidden="true" />,
  danger: <AlertCircle className="h-4 w-4" aria-hidden="true" />,
  privacy: <ShieldCheck className="h-4 w-4" aria-hidden="true" />,
  admin: <ShieldCheck className="h-4 w-4" aria-hidden="true" />
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone?: AlertTone;
  title?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border px-4 py-3 text-sm leading-6",
        toneClassName[tone],
        className
      )}
      {...props}
    >
      <span className={cn("mt-0.5 shrink-0", iconClassName[tone])}>{iconByTone[tone]}</span>
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        <div className={cn(title && "mt-0.5", "text-current/85")}>{children}</div>
      </div>
    </div>
  );
}
