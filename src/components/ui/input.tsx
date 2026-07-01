import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground shadow-none transition-colors",
        "placeholder:text-muted-foreground focus:border-primary disabled:cursor-not-allowed disabled:bg-muted",
        className
      )}
      {...props}
    />
  );
}
