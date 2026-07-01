import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClassName: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-teal-800 disabled:bg-teal-900/45",
  secondary:
    "border border-border bg-white text-foreground hover:border-slate-300 hover:bg-slate-50 disabled:bg-muted",
  ghost: "text-foreground hover:bg-muted disabled:text-muted-foreground",
  danger: "bg-danger text-danger-foreground hover:bg-red-700 disabled:bg-red-900/45"
};

export function Button({ className, variant = "primary", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors",
        "whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-70",
        variantClassName[variant],
        className
      )}
      {...props}
    />
  );
}
