import type { AnchorHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function withBasePath(href: string) {
  if (!basePath || !href.startsWith("/") || href.startsWith(basePath)) {
    return href;
  }

  return `${basePath}${href}`;
}

export function Tabs({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("overflow-x-auto border-b border-border", className)} {...props} />;
}

export function TabsList({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <nav className={cn("flex min-w-max gap-1", className)} {...props} />;
}

export function TabLink({
  active,
  className,
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; active?: boolean }) {
  return (
    <a
      href={withBasePath(href)}
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
