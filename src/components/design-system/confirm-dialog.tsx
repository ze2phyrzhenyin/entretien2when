import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  children
}: {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-floating">
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary">{cancelLabel}</Button>
        <Button>{confirmLabel}</Button>
      </div>
    </div>
  );
}
