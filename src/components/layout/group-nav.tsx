import { TabLink, Tabs, TabsList } from "@/components/ui/tabs";
import type { GroupCapabilities } from "@/lib/permissions/admin";

const groupNavItems: Array<{
  key: string;
  label: string;
  isVisible: (capabilities: GroupCapabilities) => boolean;
}> = [
  { key: "settings", label: "设置", isVisible: (capabilities) => capabilities.canManageSettings },
  { key: "slots", label: "开放时间", isVisible: (capabilities) => capabilities.canSchedule },
  { key: "candidates", label: "候选人", isVisible: (capabilities) => capabilities.canRead },
  { key: "reviews", label: "修改审核", isVisible: (capabilities) => capabilities.canReview },
  { key: "overview", label: "时间总览", isVisible: (capabilities) => capabilities.canSchedule },
  { key: "appointments", label: "面试安排", isVisible: (capabilities) => capabilities.canSchedule }
];

export function GroupNav({
  groupId,
  active,
  capabilities
}: {
  groupId: string;
  active: string;
  capabilities: GroupCapabilities;
}) {
  return (
    <Tabs className="mb-6">
      <TabsList>
        {groupNavItems
          .filter((item) => item.isVisible(capabilities))
          .map(({ key, label }) => (
            <TabLink key={key} href={`/admin/groups/${groupId}/${key}`} active={active === key}>
              {label}
            </TabLink>
          ))}
      </TabsList>
    </Tabs>
  );
}
