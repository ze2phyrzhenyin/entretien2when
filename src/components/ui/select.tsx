import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground shadow-none transition-colors",
        "focus:border-primary disabled:cursor-not-allowed disabled:bg-muted",
        className
      )}
      {...props}
    />
  );
}
