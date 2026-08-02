import { TabLink, Tabs, TabsList } from "@/components/ui/tabs";
import type { GroupCapabilities } from "@/lib/permissions/admin";
import type { MessageKey } from "@/i18n/catalogs";
import { getServerTranslator } from "@/i18n/server";

const groupNavItems: Array<{
  key: string;
  label: MessageKey;
  isVisible: (capabilities: GroupCapabilities) => boolean;
}> = [
  {
    key: "settings",
    label: "legacy.settings.df3d58c7",
    isVisible: (capabilities) => capabilities.canManageSettings
  },
  {
    key: "members",
    label: "legacy.members_and_roles.4c8d95ca",
    isVisible: (capabilities) => capabilities.canManageMembers
  },
  {
    key: "slots",
    label: "legacy.available_slots.73199769",
    isVisible: (capabilities) => capabilities.canSchedule
  },
  {
    key: "candidates",
    label: "legacy.candidates.ea62aaa5",
    isVisible: (capabilities) => capabilities.canRead
  },
  {
    key: "reviews",
    label: "legacy.change_reviews.00df3dfb",
    isVisible: (capabilities) => capabilities.canReview
  },
  {
    key: "overview",
    label: "legacy.time_overview.f6298dd3",
    isVisible: (capabilities) => capabilities.canSchedule
  },
  {
    key: "appointments",
    label: "legacy.interviews.2e9d0020",
    isVisible: (capabilities) => capabilities.canSchedule
  }
];

export async function GroupNav({
  groupId,
  active,
  capabilities
}: {
  groupId: string;
  active: string;
  capabilities: GroupCapabilities;
}) {
  const { t } = await getServerTranslator();
  return (
    <Tabs className="mb-6">
      <TabsList>
        {groupNavItems
          .filter((item) => item.isVisible(capabilities))
          .map(({ key, label }) => (
            <TabLink key={key} href={`/admin/groups/${groupId}/${key}`} active={active === key}>
              {t(label)}
            </TabLink>
          ))}
      </TabsList>
    </Tabs>
  );
}
