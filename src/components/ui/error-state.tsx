import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ErrorState({
  title = "无法加载页面",
  description = "请稍后重试，或返回上一页。",
  action,
  className
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-8 text-center", className)} variant="flat" role="alert">
      <AlertCircle className="mx-auto h-6 w-6 text-danger" aria-hidden="true" />
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </Card>
  );
}
