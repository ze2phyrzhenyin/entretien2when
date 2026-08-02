"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";

export function SubmitButton({
  children,
  pendingText,
  className,
  variant,
  size,
  disabled
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  disabled?: boolean;
}) {
  const { t } = useLocale();
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      isLoading={pending}
      className={className}
      variant={variant}
      size={size}
    >
      {pending ? (pendingText ?? t("legacy.submitting.6b70462d")) : children}
    </Button>
  );
}
