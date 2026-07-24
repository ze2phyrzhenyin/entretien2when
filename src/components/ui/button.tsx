import { cloneElement, isValidElement } from "react";
import type { ButtonHTMLAttributes, ReactElement } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  asChild?: boolean;
};

const variantClassName: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-blue-800 disabled:bg-primary/45",
  secondary:
    "border border-border bg-surface text-foreground hover:border-slate-300 hover:bg-surface-subtle disabled:bg-muted",
  ghost: "text-foreground hover:bg-muted disabled:text-muted-foreground",
  danger: "bg-danger text-danger-foreground hover:bg-red-700 disabled:bg-danger/45"
};

const sizeClassName: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
  icon: "h-10 w-10 px-0"
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  isLoading = false,
  asChild = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const classNames = cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-fast",
    "whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-70",
    variantClassName[variant],
    sizeClassName[size],
    className
  );

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{
      className?: string;
      "aria-disabled"?: boolean;
      "aria-busy"?: boolean;
    }>;
    return cloneElement(child, {
      ...props,
      "aria-disabled": disabled || isLoading || child.props["aria-disabled"],
      "aria-busy": isLoading || child.props["aria-busy"] || undefined,
      className: cn(classNames, child.props.className)
    });
  }

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={classNames}
      {...props}
    >
      {isLoading ? (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  );
}
