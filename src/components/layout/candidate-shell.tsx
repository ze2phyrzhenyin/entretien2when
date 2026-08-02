import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function CandidateShell({
  children,
  className,
  size = "default"
}: {
  children: ReactNode;
  className?: string;
  size?: "narrow" | "default" | "wide";
}) {
  const widthClassName = {
    narrow: "max-w-2xl",
    default: "max-w-candidate-content",
    wide: "max-w-6xl"
  }[size];

  return (
    <main className="min-h-screen bg-background px-4 pb-6 pt-16 sm:pb-8 sm:pt-16">
      <div className={cn("mx-auto", widthClassName, className)}>{children}</div>
    </main>
  );
}
