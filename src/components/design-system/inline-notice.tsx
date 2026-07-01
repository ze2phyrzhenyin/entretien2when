import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";

export function InlineNotice({
  tone = "info",
  title,
  children,
  className
}: {
  tone?: "info" | "success" | "warning" | "danger" | "privacy" | "admin";
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Alert tone={tone} title={title} className={className}>
      {children}
    </Alert>
  );
}
