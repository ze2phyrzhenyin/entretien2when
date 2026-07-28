import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={cn(
        "mx-auto max-w-admin-content px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 md:px-8 md:pb-8",
        className
      )}
    >
      {children}
    </main>
  );
}
