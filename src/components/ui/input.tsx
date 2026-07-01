import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  "aria-invalid": ariaInvalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      aria-invalid={ariaInvalid}
      className={cn(
        "h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground shadow-none transition-colors duration-fast",
        "placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/15",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
        ariaInvalid && "border-danger focus:border-danger focus:ring-danger/15",
        className
      )}
      {...props}
    />
  );
}
