"use client";

import { useLocale } from "@/i18n/locale-provider";
import { Check, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";
export function CandidateTimeCell({
  label,
  selected,
  disabled,
  active,
  onClick
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const { t } = useLocale();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected || undefined}
      aria-label={
        disabled
          ? t("timeCell.unavailableLabel", { label })
          : t(selected ? "timeCell.selectedLabel" : "timeCell.notSelectedLabel", { label })
      }
      className={cn(
        "flex min-h-12 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors duration-fast",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-surface text-foreground hover:border-primary hover:bg-primary-soft",
        active && "ring-2 ring-ring ring-offset-2",
        disabled &&
          "cursor-not-allowed border-slate-200 bg-muted text-muted-foreground hover:border-slate-200 hover:bg-muted"
      )}
    >
      {selected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
      {disabled ? t("legacy.not_optional.6087d10e") : label}
    </button>
  );
}
export function AdminTimeCell({
  label,
  status,
  count,
  detail
}: {
  label: React.ReactNode;
  status: "OPEN" | "CLOSED" | "LOCKED" | "SCHEDULED";
  count: number;
  detail?: string;
}) {
  const { t } = useLocale();
  const statusClassName = {
    OPEN: "border-border bg-surface",
    CLOSED: "border-border bg-muted text-muted-foreground",
    LOCKED: "border-orange-200 bg-locked-soft",
    SCHEDULED: "border-teal-200 bg-scheduled-soft"
  }[status];
  return (
    <div className={cn("min-h-24 rounded-lg border p-3 text-sm", statusClassName)}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">{label}</p>
        {status === "LOCKED" || status === "SCHEDULED" ? (
          <LockKeyhole className="h-4 w-4 text-locked" aria-hidden="true" />
        ) : null}
      </div>
      <p className="mt-3 text-muted-foreground">{t("slot.availableCandidateCount", { count })}</p>
      {detail ? <p className="mt-2 truncate text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}
