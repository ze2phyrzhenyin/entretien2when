import { getServerTranslator } from "@/i18n/server";
import Link from "next/link";
import { Search } from "lucide-react";
import { AuditActorType, type Prisma } from "@prisma/client";
import { PageHeader } from "@/components/design-system/page-header";
import { AdminShell } from "@/components/layout/admin-shell";
import { TimezoneSwitcher } from "@/components/timezone/timezone-switcher";
import { ZonedDateTime } from "@/components/timezone/zoned-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PaginationNav } from "@/components/ui/pagination-nav";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { accessibleGroupWhere, groupOwnerRoles, isSuperAdmin } from "@/lib/permissions/admin";
import { createPagination } from "@/lib/pagination";
import type { MessageKey, Translator } from "@/i18n/catalogs";
type AdminAuditPageProps = {
  searchParams: Promise<{
    q?: string;
    actor?: string;
    groupId?: string;
    page?: string;
  }>;
};
const auditLogsPageSize = 100;
const auditLogInclude = {
  actorAdmin: {
    select: {
      displayName: true,
      email: true
    }
  },
  actorCandidate: {
    select: {
      name: true,
      email: true,
      group: {
        select: {
          id: true,
          name: true,
          groupCode: true
        }
      }
    }
  },
  group: {
    select: {
      id: true,
      name: true,
      groupCode: true,
      timezone: true
    }
  }
} satisfies Prisma.AuditLogInclude;
type AuditLogRow = Prisma.AuditLogGetPayload<{
  include: typeof auditLogInclude;
}>;
type BadgeTone = "neutral" | "success" | "warning" | "danger" | "primary";
const actorTypeLabel: Record<AuditActorType, MessageKey> = {
  ADMIN: "legacy.administrator.e1979671",
  CANDIDATE: "legacy.candidates.ea62aaa5",
  SYSTEM: "legacy.system.5b50d7c4"
};
const actorTone: Record<AuditActorType, BadgeTone> = {
  ADMIN: "primary",
  CANDIDATE: "warning",
  SYSTEM: "neutral"
};
const auditActionLabel: Record<string, MessageKey> = {
  "admin.create_group": "legacy.create_interview_group.b24fbbc5",
  "admin.update_group": "legacy.update_interview_group_settings.2d4b312e",
  "admin.batch_generate_slots": "legacy.batch_generation_opening_hours.06539024",
  "admin.update_slot_status": "legacy.update_opening_hours_status.b6607a23",
  "admin.batch_delete_slots": "legacy.delete_opening_hours_in_batches.2ccfa1c1",
  "admin.clear_slots": "legacy.clear_opening_hours.3fe63c16",
  "candidate.submit_initial_availability": "legacy.candidate_s_first_submission.070a159c",
  "candidate.request_submission_modification": "legacy.candidate_application_modification.1971427e",
  "admin.approve_submission_modification": "legacy.admin_applies_through_modifications.a2b2e3f0",
  "admin.reject_submission_modification":
    "legacy.the_administrator_rejected_the_modification_request.8c33262c",
  "admin.schedule_appointment": "legacy.confirm_interview_schedule.4b0df711",
  "admin.reschedule_appointment": "legacy.adjust_interview_schedule.30512cbe",
  "admin.cancel_appointment": "legacy.cancel_interview_schedule.154c9384",
  "admin.upsert_candidate_admin_note": "legacy.save_administrator_follow_up_notes.99f85f89",
  "admin.send_candidate_email": "legacy.send_candidate_notification.ffe8f9df",
  "admin.queue_candidate_email": "legacy.candidate_notification_enters_sending_queue.f896b794",
  "admin.send_appointment_email": "legacy.send_interview_schedule_notification.b4c9314e",
  "admin.retry_candidate_email": "legacy.retry_candidate_notification.2628ffa2",
  "admin.send_mailato_email": "legacy.send_email.c268c1b1",
  "admin.update_email_template": "legacy.update_email_template.5c8daf3a",
  "admin.reset_email_template": "legacy.restore_default_email_template.ec6067df",
  "admin.create_administrator": "legacy.create_administrator.09728129",
  "admin.update_administrator": "legacy.update_administrator_role_or_status.60d2ad6c",
  "admin.reset_administrator_password": "legacy.reset_administrator_password.f8460de9",
  "admin.create_group_membership": "legacy.add_group_members.b31a8a36",
  "admin.update_group_membership": "legacy.update_group_member_roles.94b28649",
  "admin.revoke_group_membership": "legacy.revoke_group_member_permissions.fd9f8bf5",
  "admin.create_interview_round": "legacy.create_interview_rounds.cc7c25c7",
  "admin.update_interview_round": "legacy.update_interview_rounds.8213cbae",
  "admin.upsert_interviewer": "legacy.add_or_update_interviewers.2bc5ad94",
  "admin.update_interviewer_status": "legacy.update_interviewer_status.b6e30b47",
  "admin.export_candidate_data": "legacy.export_candidate_data.e743f7c5",
  "admin.anonymize_candidate": "legacy.anonymize_candidate_data.41c992cd",
  "system.admin_login_failed": "legacy.administrator_login_failed.fb2c5d2a",
  "system.appointment_email_skipped": "legacy.skip_expired_scheduled_emails.9ea6957c",
  "system.owner_notification_not_queued":
    "legacy.notification_from_the_person_in_charge_of_not_joining_the_team.a7bd6e98",
  "system.process_candidate_email_delivery": "legacy.process_the_candidate_mail_queue.fbba91d7",
  "system.queue_candidate_access_link": "legacy.candidate_access_link_to_join_the_team.810205d6"
};
const entityTypeLabel: Record<string, MessageKey> = {
  InterviewGroup: "legacy.interview_groups.e677802f",
  GroupTimeSlot: "legacy.available_slots.73199769",
  CandidateSubmission: "legacy.candidate_submission.198713f2",
  Appointment: "legacy.interviews.2e9d0020",
  CandidateAdminNote: "legacy.administrator_follow_up_notes.a49ca10e",
  CandidateEmailBatch: "legacy.candidate_notification_batch.f6b91b63",
  CandidateEmailDelivery: "legacy.candidate_notification_record.6b16c87f",
  EmailTemplate: "legacy.email_templates.3e24ad26",
  MailatoEmail: "legacy.email_sending_record.e15cef5b",
  Admin: "legacy.administrator.e1979671",
  AdminGroupMembership: "legacy.group_membership_permissions.6c545533",
  InterviewRound: "legacy.interview_rounds.f084efaf",
  Interviewer: "legacy.interviewers.5e6ecb10",
  Candidate: "legacy.candidates.ea62aaa5"
};
function parseActorType(value: string | undefined) {
  if (
    value === AuditActorType.ADMIN ||
    value === AuditActorType.CANDIDATE ||
    value === AuditActorType.SYSTEM
  ) {
    return value;
  }
  return undefined;
}
function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}
function formatJson(value: Prisma.JsonValue | null) {
  if (value === null) {
    return "";
  }
  const text = JSON.stringify(value);
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}
function getActorDisplay(log: AuditLogRow, t: Translator) {
  if (log.actorType === AuditActorType.ADMIN && log.actorAdmin) {
    return {
      primary: log.actorAdmin.displayName,
      secondary: log.actorAdmin.email
    };
  }
  if (log.actorType === AuditActorType.CANDIDATE && log.actorCandidate) {
    return {
      primary: log.actorCandidate.name,
      secondary: log.actorCandidate.email
    };
  }
  return {
    primary: t(actorTypeLabel[log.actorType]),
    secondary: ""
  };
}
function getGroupDisplay(log: AuditLogRow) {
  return log.group ?? log.actorCandidate?.group ?? null;
}
export default async function AdminAuditPage({ searchParams }: AdminAuditPageProps) {
  const { t } = await getServerTranslator();
  const [admin, query] = await Promise.all([requireAdmin(), searchParams]);
  const q = query.q?.trim() ?? "";
  const actorType = parseActorType(query.actor);
  const selectedGroupId = query.groupId?.trim() ?? "";
  const superAdmin = isSuperAdmin(admin);
  const accessibleGroups = await prisma.interviewGroup.findMany({
    // Audit payloads may contain candidate and operator PII. They are an
    // ownership/governance surface rather than a generic group-read surface.
    where: accessibleGroupWhere(admin, groupOwnerRoles),
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      groupCode: true
    }
  });
  const accessibleGroupIds = new Set(accessibleGroups.map((group) => group.id));
  const filters: Prisma.AuditLogWhereInput[] = [];
  if (!superAdmin) {
    filters.push({
      groupId: {
        in: [...accessibleGroupIds]
      }
    });
  }
  if (actorType) {
    filters.push({ actorType });
  }
  if (selectedGroupId && (superAdmin || accessibleGroupIds.has(selectedGroupId))) {
    filters.push({ groupId: selectedGroupId });
  } else if (selectedGroupId) {
    filters.push({ groupId: "__no_access__" });
  }
  if (q) {
    filters.push({
      OR: [
        { action: { contains: q, mode: "insensitive" } },
        { entityType: { contains: q, mode: "insensitive" } },
        { entityId: { contains: q, mode: "insensitive" } },
        {
          actorAdmin: {
            is: {
              OR: [
                { displayName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } }
              ]
            }
          }
        },
        {
          actorCandidate: {
            is: {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } }
              ]
            }
          }
        },
        {
          group: {
            is: {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { groupCode: { contains: q, mode: "insensitive" } }
              ]
            }
          }
        }
      ]
    });
  }
  const where: Prisma.AuditLogWhereInput = filters.length > 0 ? { AND: filters } : {};
  const totalCount = await prisma.auditLog.count({ where });
  const pagination = createPagination({
    page: query.page,
    pageSize: auditLogsPageSize,
    totalCount
  });
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: pagination.skip,
    take: pagination.pageSize,
    include: auditLogInclude
  });
  return (
    <AdminShell admin={admin} active="audit">
      <PageHeader
        title={t("legacy.audit_log.a0f79e91")}
        description={
          superAdmin
            ? t("legacy.view_all_key_business_audit_records.bb327f3f")
            : t(
                "legacy.view_audit_records_only_for_the_interview_groups_you_manage_as_a_princip.db8f3d02"
              )
        }
        action={
          <p className="text-sm text-muted-foreground">
            {t("audit.countSummary", { shown: logs.length, total: totalCount })}
          </p>
        }
      />
      <div className="mb-4">
        <TimezoneSwitcher defaultTimezone="Asia/Shanghai" />
      </div>

      <Card className="mb-4 p-4">
        <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_240px_auto_auto]">
          <div className="relative">
            <label className="sr-only" htmlFor="auditSearch">
              {t("legacy.search_audit_logs.e824b6c9")}
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="auditSearch"
              name="q"
              defaultValue={q}
              placeholder={t("legacy.search_for_actions_objects_people_or_numbers.337a5ab3")}
              className="pl-9"
            />
          </div>

          <div>
            <label className="sr-only" htmlFor="auditActor">
              {t("legacy.operator_type.c02fe8d1")}
            </label>
            <Select id="auditActor" name="actor" defaultValue={actorType ?? ""}>
              <option value="">{t("legacy.all_operators.655d3c9d")}</option>
              <option value={AuditActorType.ADMIN}>{t("legacy.administrator.e1979671")}</option>
              <option value={AuditActorType.CANDIDATE}>{t("legacy.candidates.ea62aaa5")}</option>
              <option value={AuditActorType.SYSTEM}>{t("legacy.system.5b50d7c4")}</option>
            </Select>
          </div>

          <div>
            <label className="sr-only" htmlFor="auditGroup">
              {t("legacy.interview_groups.e677802f")}
            </label>
            <Select id="auditGroup" name="groupId" defaultValue={selectedGroupId}>
              <option value="">{t("legacy.all_interview_groups.f0e3213c")}</option>
              {accessibleGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} · {group.groupCode}
                </option>
              ))}
            </Select>
          </div>

          <Button type="submit" variant="secondary" className="h-11">
            <Search className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("legacy.search.44ce7ae9")}
          </Button>
          {q || actorType || selectedGroupId ? (
            <Link
              href="/admin/audit"
              className="inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              {t("legacy.clear.bce23772")}
            </Link>
          ) : null}
        </form>
      </Card>

      {logs.length === 0 ? (
        <EmptyState
          title={t("legacy.no_audit_records_yet.1fbef39b")}
          description={t(
            "legacy.when_the_administrator_or_candidate_completes_submission_review_intervie.466481c1"
          )}
        />
      ) : (
        <div className="space-y-4">
          <TableContainer>
            <Table className="min-w-[980px]">
              <TableHeader>
                <tr>
                  <TableHead>{t("legacy.time.8b6ff498")}</TableHead>
                  <TableHead>{t("legacy.actions.ed31fbb4")}</TableHead>
                  <TableHead>{t("legacy.operator.e18e3f8a")}</TableHead>
                  <TableHead>{t("legacy.interview_groups.e677802f")}</TableHead>
                  <TableHead>{t("legacy.object.53f92c06")}</TableHead>
                  <TableHead>{t("legacy.data.5440f742")}</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const actor = getActorDisplay(log, t);
                  const actionLabel = auditActionLabel[log.action];
                  const entityLabel = entityTypeLabel[log.entityType];
                  const group = getGroupDisplay(log);
                  const beforeData = formatJson(log.beforeData);
                  const afterData = formatJson(log.afterData);
                  return (
                    <TableRow key={log.id} className="align-top">
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        <ZonedDateTime
                          value={log.createdAt.toISOString()}
                          defaultTimezone={log.group?.timezone ?? "Asia/Shanghai"}
                        />
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{actionLabel ? t(actionLabel) : log.action}</p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">{log.action}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge tone={actorTone[log.actorType]}>
                            {t(actorTypeLabel[log.actorType])}
                          </Badge>
                          <p className="font-medium">{actor.primary}</p>
                          {actor.secondary ? (
                            <p className="text-xs text-muted-foreground">{actor.secondary}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {group ? (
                          <Link
                            className="font-medium text-primary"
                            href={`/admin/groups/${group.id}/settings`}
                          >
                            {group.name}
                            <span className="block font-mono text-xs text-muted-foreground">
                              {group.groupCode}
                            </span>
                          </Link>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <p>{entityLabel ? t(entityLabel) : log.entityType}</p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          {shortId(log.entityId)}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-sm">
                        {beforeData || afterData ? (
                          <div className="space-y-1">
                            {beforeData ? (
                              <p className="truncate font-mono text-xs" title={beforeData}>
                                {t("audit.changeBefore", { value: beforeData })}
                              </p>
                            ) : null}
                            {afterData ? (
                              <p className="truncate font-mono text-xs" title={afterData}>
                                {t("audit.changeAfter", { value: afterData })}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <PaginationNav
            pathname="/admin/audit"
            searchParams={{
              q: q || undefined,
              actor: actorType ?? undefined,
              groupId: selectedGroupId || undefined
            }}
            itemLabel={t("legacy.audit_records.c6ed100a")}
            {...pagination}
          />
        </div>
      )}
    </AdminShell>
  );
}
