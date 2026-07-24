import { cloneElement, isValidElement, useId } from "react";
import type { ReactElement, ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function FormField({
  id,
  label,
  description,
  error,
  children,
  className
}: {
  id?: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const generatedId = useId();
  const child = isValidElement(children)
    ? (children as ReactElement<{
        id?: string;
        "aria-describedby"?: string;
        "aria-invalid"?: boolean;
      }>)
    : null;
  const fieldId = id ?? child?.props.id ?? generatedId;
  const descriptionId = description ? `${fieldId}-description` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy =
    [child?.props["aria-describedby"], descriptionId, errorId].filter(Boolean).join(" ") ||
    undefined;
  const field = child
    ? cloneElement(child, {
        id: child.props.id ?? fieldId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : child.props["aria-invalid"]
      })
    : children;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={fieldId}>{label}</Label>
      {field}
      {description ? (
        <p id={descriptionId} className="text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs leading-5 text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
