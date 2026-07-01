import type { DialogHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Dialog({ className, ...props }: DialogHTMLAttributes<HTMLDialogElement>) {
  return (
    <dialog
      className={cn(
        "rounded-2xl border border-border bg-surface p-0 text-foreground shadow-floating backdrop:bg-slate-950/40",
        className
      )}
      {...props}
    />
  );
}

export function DialogBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...props} />;
}
