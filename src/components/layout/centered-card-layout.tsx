import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function CenteredCardLayout({
  children,
  maxWidthClassName = "max-w-lg",
  className
}: {
  children: ReactNode;
  maxWidthClassName?: string;
  className?: string;
}) {
  return (
    <main className={cn("min-h-screen bg-background px-4 py-8", className)}>
      <div className={cn("mx-auto flex min-h-[calc(100vh-4rem)] items-center", maxWidthClassName)}>
        <Card className="w-full p-6 sm:p-8">{children}</Card>
      </div>
    </main>
  );
}
