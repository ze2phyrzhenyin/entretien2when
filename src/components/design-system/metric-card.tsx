import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  description,
  icon,
  className
}: {
  label: ReactNode;
  value: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)} variant="flat">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
        </div>
        {icon ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
            {icon}
          </div>
        ) : null}
      </div>
      {description ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
      ) : null}
    </Card>
  );
}
