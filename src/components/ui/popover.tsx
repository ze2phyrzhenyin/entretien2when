import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function PopoverPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface p-4 text-sm shadow-floating",
        className
      )}
      {...props}
    />
  );
}
