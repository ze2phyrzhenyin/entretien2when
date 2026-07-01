import Link from "next/link";
import { cn } from "@/lib/utils";

const groupNavItems = [
  ["settings", "设置"],
  ["slots", "时间段"],
  ["candidates", "候选人"],
  ["reviews", "修改审核"],
  ["overview", "时间总览"],
  ["appointments", "预约"]
] as const;

export function GroupAdminNav({ groupId, active }: { groupId: string; active: string }) {
  return (
    <div className="mb-6 overflow-x-auto border-b border-border">
      <nav className="flex min-w-max gap-1">
        {groupNavItems.map(([key, label]) => (
          <Link
            key={key}
            href={`/admin/groups/${groupId}/${key}`}
            className={cn(
              "border-b-2 px-3 py-3 text-sm font-medium transition-colors",
              active === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
