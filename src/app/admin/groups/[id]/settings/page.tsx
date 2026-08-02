import { getServerTranslator } from "@/i18n/server";
import Link from "next/link";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { PageHeader } from "@/components/design-system/page-header";
import { SectionHeader } from "@/components/design-system/section-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupNav } from "@/components/layout/group-nav";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { requireAdmin } from "@/lib/auth/session";
import { getCandidateGroupPublicUrl } from "@/lib/app-url";
import { timezoneOptionsWith } from "@/lib/date/timezone";
import { prisma } from "@/lib/db/prisma";
import {
  getGroupCapabilities,
  groupOwnerRoles,
  requireGroupPermission
} from "@/lib/permissions/admin";
import { GroupSettingsForm } from "./group-settings-form";
type SettingsPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    created?: string;
  }>;
};
export default async function GroupSettingsPage({ params, searchParams }: SettingsPageProps) {
  const { t } = await getServerTranslator();
  const [{ id: groupId }, query] = await Promise.all([params, searchParams]);
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, groupOwnerRoles);
  const capabilities = await getGroupCapabilities(admin, groupId);
  const group = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId },
    include: {
      project: {
        select: {
          id: true,
          name: true
        }
      },
      round: {
        select: {
          name: true,
          interviewDurationMinutes: true
        }
      }
    }
  });
  // Keep the copyable entry link on the same validated public-origin/basePath
  // contract as magic links and Route Handler redirects.
  const candidateLink = getCandidateGroupPublicUrl(group.groupCode);
  return (
    <AdminShell admin={admin}>
      <GroupNav groupId={groupId} active="settings" capabilities={capabilities} />
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {group.name}
            <StatusBadge kind="group" status={group.status} />
          </span>
        }
        description={t(
          "legacy.configure_disclosure_instructions_time_rules_and_candidate_portals.8c57a733"
        )}
        action={
          <Link className="text-sm font-medium text-primary" href="/admin">
            {t("legacy.return_to_workbench.de7efab0")}
          </Link>
        }
      />

      {query.created ? (
        <InlineNotice tone="success" className="mb-5">
          {t(
            "legacy.interview_group_has_been_created_please_copy_the_interview_group_number_.682f6d92"
          )}
        </InlineNotice>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-6">
          <SectionHeader
            title={t("legacy.interview_group_information.aade7203")}
            description={t(
              "legacy.candidates_can_see_the_interview_group_name_and_public_description_but_n.3471dcbf"
            )}
          />
          <GroupSettingsForm
            groupId={groupId}
            group={{
              name: group.name,
              publicDescription: group.publicDescription ?? "",
              timezone: group.timezone,
              status: group.status,
              slotDurationMinutes: group.slotDurationMinutes,
              interviewDurationMinutes: group.interviewDurationMinutes,
              minSelectSlots: group.minSelectSlots,
              maxSelectSlots: group.maxSelectSlots
            }}
            timezoneOptions={timezoneOptionsWith(group.timezone)}
          />
        </Card>

        <Card className="p-5">
          <SectionHeader
            title={t("legacy.candidate_entrance.868a6d49")}
            description={t(
              "legacy.candidates_who_open_the_link_and_submit_their_name_email_address_and_ava.5817c8a6"
            )}
          />
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">
                {t("legacy.interview_group_number.56682195")}
              </p>
              <p className="mt-1 break-all font-mono text-sm font-semibold">{group.groupCode}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("legacy.candidate_link.e8475e91")}</p>
              <p className="mt-1 break-all font-mono text-sm font-semibold">{candidateLink}</p>
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">{t("legacy.project_round.9d456441")}</p>
              {group.project ? (
                <Link
                  href={`/admin/projects/${group.project.id}`}
                  className="mt-1 inline-flex text-sm font-semibold text-primary"
                >
                  {group.project.name}
                </Link>
              ) : (
                <p className="mt-1 text-sm font-semibold">
                  {t("legacy.no_associated_projects.46062b1a")}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {group.round
                  ? group.round.interviewDurationMinutes
                    ? t("group.roundDurationSummary", {
                        roundName: group.round.name,
                        minutes: group.round.interviewDurationMinutes
                      })
                    : t("group.roundWithoutDuration", { roundName: group.round.name })
                  : t("legacy.unassociated_rounds.f21aa45d")}
              </p>
            </div>
            <CopyButton
              value={group.groupCode}
              label={t("legacy.copy_interview_group_number.276635d4")}
            />
            <CopyButton value={candidateLink} label={t("legacy.copy_candidate_link.b6d1fe0f")} />
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
