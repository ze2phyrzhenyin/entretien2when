import type { AnchorHTMLAttributes, HTMLAttributes } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Tabs({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("overflow-x-auto border-b border-border", className)} {...props} />;
}

export function TabsList({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <nav className={cn("flex min-w-max gap-1", className)} {...props} />;
}

export function TabLink({
  active,
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; active?: boolean }) {
  return (
    <Link
      className={cn(
        "border-b-2 px-3 py-3 text-sm font-medium transition-colors duration-fast",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}
    />
  );
}
