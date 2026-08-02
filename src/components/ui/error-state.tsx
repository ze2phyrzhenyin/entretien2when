"use client";

import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/locale-provider";

export function ErrorState({
  title,
  description,
  action,
  className
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  const { t } = useLocale();
  const resolvedTitle = title ?? t("legacy.unable_to_load_page.ff962b05");
  const resolvedDescription =
    description ?? t("legacy.please_try_again_later_or_return_to_the_previous_page.dbd2ab7d");
  return (
    <Card className={cn("p-8 text-center", className)} variant="flat" role="alert">
      <AlertCircle className="mx-auto h-6 w-6 text-danger" aria-hidden="true" />
      <h3 className="mt-3 text-base font-semibold">{resolvedTitle}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
        {resolvedDescription}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </Card>
  );
}
