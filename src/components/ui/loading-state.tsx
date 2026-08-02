import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getServerTranslator } from "@/i18n/server";

export async function LoadingState({
  title,
  description,
  className
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  const { t } = await getServerTranslator();
  const resolvedTitle = title ?? t("legacy.loading.f020e463");
  const resolvedDescription = description ?? t("legacy.please_wait.043bd055");
  return (
    <Card className={cn("p-8 text-center", className)} variant="flat" role="status">
      <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" aria-hidden="true" />
      <h3 className="mt-3 text-base font-semibold">{resolvedTitle}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{resolvedDescription}</p>
    </Card>
  );
}
