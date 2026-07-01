import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function LoadingState({
  title = "正在加载",
  description = "请稍候。",
  className
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <Card className={cn("p-8 text-center", className)} variant="flat" role="status">
      <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" aria-hidden="true" />
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Card>
  );
}
