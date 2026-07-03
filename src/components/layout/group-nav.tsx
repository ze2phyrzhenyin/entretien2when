import { TabLink, Tabs, TabsList } from "@/components/ui/tabs";

const groupNavItems = [
  ["settings", "设置"],
  ["slots", "时间段"],
  ["candidates", "候选人"],
  ["reviews", "修改审核"],
  ["overview", "时间总览"],
  ["appointments", "预约"]
] as const;

export function GroupNav({ groupId, active }: { groupId: string; active: string }) {
  return (
    <Tabs className="mb-6">
      <TabsList>
        {groupNavItems.map(([key, label]) => (
          <TabLink key={key} href={`/admin/groups/${groupId}/${key}`} active={active === key}>
            {label}
          </TabLink>
        ))}
      </TabsList>
    </Tabs>
  );
}
