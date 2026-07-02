import Link from "next/link";
import { Search } from "lucide-react";
import { AdminRole, AuditActorType, type Prisma } from "@prisma/client";
import { PageHeader } from "@/components/design-system/page-header";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
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

type AdminAuditPageProps = {
  searchParams: Promise<{ q?: string; actor?: string; groupId?: string }>;
};

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
      groupCode: true
    }
  }
} satisfies Prisma.AuditLogInclude;

type AuditLogRow = Prisma.AuditLogGetPayload<{ include: typeof auditLogInclude }>;
type BadgeTone = "neutral" | "success" | "warning" | "danger" | "primary";

const actorTypeLabel: Record<AuditActorType, string> = {
  ADMIN: "管理员",
  CANDIDATE: "候选人",
  SYSTEM: "系统"
};

const actorTone: Record<AuditActorType, BadgeTone> = {
  ADMIN: "primary",
  CANDIDATE: "warning",
  SYSTEM: "neutral"
};

const auditActionLabel: Record<string, string> = {
  "admin.create_group": "创建面试组",
  "admin.update_group": "更新面试组设置",
  "admin.grant_group_admin": "授权组管理员",
  "admin.revoke_group_admin": "撤销组管理员",
  "admin.batch_generate_slots": "批量生成时间段",
  "admin.update_slot_status": "更新时间段状态",
  "candidate.submit_initial_availability": "候选人首次提交",
  "candidate.request_submission_modification": "候选人申请修改",
  "admin.approve_submission_modification": "管理员通过修改申请",
  "admin.reject_submission_modification": "管理员拒绝修改申请",
  "admin.schedule_appointment": "管理员安排面试",
  "admin.cancel_appointment": "管理员取消预约",
  "admin.upsert_candidate_admin_note": "保存管理员私有备注",
  "admin.send_candidate_email": "发送候选人邮件",
  "admin.retry_candidate_email": "重试候选人邮件"
};

const entityTypeLabel: Record<string, string> = {
  InterviewGroup: "面试组",
  GroupAdmin: "组管理员授权",
  GroupTimeSlot: "时间段",
  CandidateSubmission: "候选人提交",
  Appointment: "预约",
  CandidateAdminNote: "管理员私有备注",
  CandidateEmailBatch: "候选人邮件批次",
  CandidateEmailDelivery: "候选人邮件记录"
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

function formatDateTime(value: Date) {
  return value.toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
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

function getActorDisplay(log: AuditLogRow) {
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
    primary: actorTypeLabel[log.actorType],
    secondary: ""
  };
}

function getGroupDisplay(log: AuditLogRow) {
  return log.group ?? log.actorCandidate?.group ?? null;
}

export default async function AdminAuditPage({ searchParams }: AdminAuditPageProps) {
  const [admin, query] = await Promise.all([requireAdmin(), searchParams]);
  const q = query.q?.trim() ?? "";
  const actorType = parseActorType(query.actor);
  const selectedGroupId = query.groupId?.trim() ?? "";

  const groupAccessWhere: Prisma.InterviewGroupWhereInput =
    admin.role === AdminRole.SUPER_ADMIN
      ? {}
      : {
          groupAdmins: {
            some: {
              adminId: admin.id
            }
          }
        };
  const accessibleGroups = await prisma.interviewGroup.findMany({
    where: groupAccessWhere,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      groupCode: true
    }
  });
  const accessibleGroupIds = new Set(accessibleGroups.map((group) => group.id));

  const filters: Prisma.AuditLogWhereInput[] = [];

  if (admin.role !== AdminRole.SUPER_ADMIN) {
    filters.push({
      OR: [
        { actorAdminId: admin.id },
        {
          group: {
            is: {
              groupAdmins: {
                some: {
                  adminId: admin.id
                }
              }
            }
          }
        }
      ]
    });
  }

  if (actorType) {
    filters.push({ actorType });
  }

  if (selectedGroupId) {
    filters.push({ groupId: selectedGroupId });
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
  const [logs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: auditLogInclude
    }),
    prisma.auditLog.count({ where })
  ]);

  return (
    <AdminShell admin={admin} active="audit">
      <PageHeader
        title="操作日志"
        description="超级管理员可查看全部日志；普通管理员可查看已授权面试组日志和自己发起的操作。"
        action={
          <p className="text-sm text-muted-foreground">
            显示最近 {logs.length} 条，共 {totalCount} 条
          </p>
        }
      />

      <Card className="mb-4 p-4">
        <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_240px_auto_auto]">
          <div className="relative">
            <label className="sr-only" htmlFor="auditSearch">
              搜索操作日志
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="auditSearch"
              name="q"
              defaultValue={q}
              placeholder="搜索操作、对象、人员或组编号"
              className="pl-9"
            />
          </div>

          <div>
            <label className="sr-only" htmlFor="auditActor">
              操作者类型
            </label>
            <Select id="auditActor" name="actor" defaultValue={actorType ?? ""}>
              <option value="">全部操作者</option>
              <option value={AuditActorType.ADMIN}>管理员</option>
              <option value={AuditActorType.CANDIDATE}>候选人</option>
              <option value={AuditActorType.SYSTEM}>系统</option>
            </Select>
          </div>

          <div>
            <label className="sr-only" htmlFor="auditGroup">
              面试组
            </label>
            <Select id="auditGroup" name="groupId" defaultValue={selectedGroupId}>
              <option value="">全部面试组</option>
              {accessibleGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} · {group.groupCode}
                </option>
              ))}
            </Select>
          </div>

          <Button type="submit" variant="secondary" className="h-11">
            <Search className="mr-2 h-4 w-4" aria-hidden="true" />
            搜索
          </Button>
          {q || actorType || selectedGroupId ? (
            <Link
              href="/admin/audit"
              className="inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              清除
            </Link>
          ) : null}
        </form>
      </Card>

      {logs.length === 0 ? (
        <EmptyState
          title="暂无操作日志"
          description="当管理员或候选人完成提交、审核、预约、取消预约等动作后，这里会显示审计记录。"
        />
      ) : (
        <TableContainer>
          <Table className="min-w-[980px]">
            <TableHeader>
              <tr>
                <TableHead>时间</TableHead>
                <TableHead>操作</TableHead>
                <TableHead>操作者</TableHead>
                <TableHead>面试组</TableHead>
                <TableHead>对象</TableHead>
                <TableHead>数据</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const actor = getActorDisplay(log);
                const group = getGroupDisplay(log);
                const beforeData = formatJson(log.beforeData);
                const afterData = formatJson(log.afterData);
                const canLinkGroup =
                  Boolean(group) &&
                  (admin.role === AdminRole.SUPER_ADMIN || accessibleGroupIds.has(group?.id ?? ""));

                return (
                  <TableRow key={log.id} className="align-top">
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{auditActionLabel[log.action] ?? log.action}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{log.action}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <Badge tone={actorTone[log.actorType]}>
                          {actorTypeLabel[log.actorType]}
                        </Badge>
                        <p className="font-medium">{actor.primary}</p>
                        {actor.secondary ? (
                          <p className="text-xs text-muted-foreground">{actor.secondary}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {group ? (
                        canLinkGroup ? (
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
                          <span>
                            {group.name}
                            <span className="block font-mono text-xs text-muted-foreground">
                              {group.groupCode}
                            </span>
                          </span>
                        )
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <p>{entityTypeLabel[log.entityType] ?? log.entityType}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {shortId(log.entityId)}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-sm">
                      {beforeData || afterData ? (
                        <div className="space-y-1">
                          {beforeData ? (
                            <p className="truncate font-mono text-xs" title={beforeData}>
                              前：{beforeData}
                            </p>
                          ) : null}
                          {afterData ? (
                            <p className="truncate font-mono text-xs" title={afterData}>
                              后：{afterData}
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
      )}
    </AdminShell>
  );
}
