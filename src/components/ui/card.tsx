import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "flat" | "subtle";

const variantClassName: Record<CardVariant, string> = {
  default: "border border-border bg-surface shadow-subtle",
  flat: "border border-border bg-surface",
  subtle: "border border-border bg-surface-subtle"
};

export function Card({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  return <div className={cn("rounded-xl", variantClassName[variant], className)} {...props} />;
}
