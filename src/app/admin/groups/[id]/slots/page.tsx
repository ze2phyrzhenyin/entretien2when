import { GroupTimeSlotStatus, type Prisma } from "@prisma/client";
import { FormField } from "@/components/design-system/form-field";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { PageHeader } from "@/components/design-system/page-header";
import { SectionHeader } from "@/components/design-system/section-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupNav } from "@/components/layout/group-nav";
import { AdminSlotLegend } from "@/components/scheduling/slot-legend";
import { TimezoneSwitcher } from "@/components/timezone/timezone-switcher";
import { ZonedDateTimeRange } from "@/components/timezone/zoned-time";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PaginationNav } from "@/components/ui/pagination-nav";
import { SubmitButton } from "@/components/ui/submit-button";
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
import {
  getGroupCapabilities,
  groupSchedulingRoles,
  requireGroupPermission
} from "@/lib/permissions/admin";
import { createPagination } from "@/lib/pagination";
import {
  batchGenerateSlotsAction,
  deleteSlotsAction,
  updateSlotStatusAction
} from "@/server/actions/slot";

type SlotsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    slotGenerate?: string;
    slotGenerated?: string;
    slotSkippedGenerate?: string;
    slotDelete?: string;
    slotDeleted?: string;
    slotSkipped?: string;
    page?: string;
  }>;
};

const slotsPageSize = 100;

export default async function GroupSlotsPage({ params, searchParams }: SlotsPageProps) {
  const [{ id: groupId }, query] = await Promise.all([params, searchParams]);
  const admin = await requireAdmin();
  await requireGroupPermission(admin, groupId, groupSchedulingRoles);
  const capabilities = await getGroupCapabilities(admin, groupId);

  const deletableSlotWhere: Prisma.GroupTimeSlotWhereInput = {
    groupId,
    activeLock: { is: null },
    submissionSlots: { none: {} },
    appointmentSlots: { none: {} },
    locks: { none: {} }
  };
  const [group, totalSlotCount, deletableSlotCount] = await Promise.all([
    prisma.interviewGroup.findUniqueOrThrow({
      where: { id: groupId },
      select: { name: true, timezone: true }
    }),
    prisma.groupTimeSlot.count({ where: { groupId } }),
    prisma.groupTimeSlot.count({ where: deletableSlotWhere })
  ]);
  const pagination = createPagination({
    page: query.page,
    pageSize: slotsPageSize,
    totalCount: totalSlotCount
  });
  const timeSlots = await prisma.groupTimeSlot.findMany({
    where: { groupId },
    orderBy: [{ startAt: "asc" }, { id: "asc" }],
    skip: pagination.skip,
    take: pagination.pageSize,
    include: {
      activeLock: true,
      submissionSlots: {
        select: { id: true }
      },
      appointmentSlots: {
        select: { id: true }
      },
      locks: {
        select: { id: true }
      }
    }
  });
  const deletedCount = Number(query.slotDeleted ?? 0);
  const skippedCount = Number(query.slotSkipped ?? 0);
  const generatedCount = Number(query.slotGenerated ?? 0);
  const skippedGenerateCount = Number(query.slotSkippedGenerate ?? 0);
  return (
    <AdminShell admin={admin}>
      <GroupNav groupId={groupId} active="slots" capabilities={capabilities} />
      <PageHeader
        title="开放时间配置"
        description={`按面试组时区生成开放时间。当前显示 ${timeSlots.length} / ${totalSlotCount} 个开放时间。`}
      />
      <div className="mb-5">
        <TimezoneSwitcher defaultTimezone={group.timezone} />
      </div>
      {query.slotGenerate === "generated" ? (
        <InlineNotice tone="success" className="mb-5">
          已生成 {generatedCount} 个开放时间
          {skippedGenerateCount > 0 ? `，跳过 ${skippedGenerateCount} 个已存在的开放时间` : ""}。
        </InlineNotice>
      ) : null}
      {query.slotGenerate === "empty" ? (
        <InlineNotice tone="warning" className="mb-5">
          没有生成新的开放时间。请确认起止时间至少覆盖一个时间粒度，或这些开放时间尚未存在。
        </InlineNotice>
      ) : null}
      {query.slotGenerate === "invalid" ? (
        <InlineNotice tone="warning" className="mb-5">
          请检查开始日期、结束日期和起止时间。
        </InlineNotice>
      ) : null}
      {query.slotGenerate === "dst" ? (
        <InlineNotice tone="warning" className="mb-5">
          所选时段跨越夏令时切换，包含不存在或重复的本地时间。请拆分范围并避开该时段，避免生成含糊的预约时间。
        </InlineNotice>
      ) : null}
      {query.slotDelete === "deleted" ? (
        <InlineNotice tone="success" className="mb-5">
          已删除 {deletedCount} 个开放时间。
        </InlineNotice>
      ) : null}
      {query.slotDelete === "partial" ? (
        <InlineNotice tone="warning" className="mb-5">
          已删除 {deletedCount} 个开放时间，跳过 {skippedCount} 个已有业务引用的开放时间。
        </InlineNotice>
      ) : null}
      {query.slotDelete === "blocked" ? (
        <InlineNotice tone="warning" className="mb-5">
          没有可删除的开放时间。已被候选人提交、面试安排或锁定引用的开放时间会被保留。
        </InlineNotice>
      ) : null}
      {query.slotDelete === "invalid" ? (
        <InlineNotice tone="warning" className="mb-5">
          请先选择开放时间并勾选删除确认。
        </InlineNotice>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="p-5">
          <SectionHeader title="批量生成开放时间" description={`当前时区：${group.timezone}`} />
          <form action={batchGenerateSlotsAction.bind(null, groupId)} className="mt-4 space-y-4">
            <FormField id="dateFrom" label="开始日期">
              <Input id="dateFrom" name="dateFrom" type="date" required />
            </FormField>
            <FormField id="dateTo" label="结束日期">
              <Input id="dateTo" name="dateTo" type="date" required />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField id="startTime" label="开始时间">
                <Input id="startTime" name="startTime" type="time" defaultValue="09:00" required />
              </FormField>
              <FormField id="endTime" label="结束时间">
                <Input id="endTime" name="endTime" type="time" defaultValue="18:00" required />
              </FormField>
            </div>
            <SubmitButton className="w-full" pendingText="正在生成">
              生成开放时间
            </SubmitButton>
          </form>
        </Card>

        <div>
          <div className="mb-4">
            <AdminSlotLegend />
          </div>
          {timeSlots.length === 0 ? (
            <EmptyState
              title="暂无开放时间"
              description="请先用左侧表单批量生成开放时间。候选人只能选择已开放且未锁定的时间。"
            />
          ) : (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <form
                    id="deleteSlotsForm"
                    action={deleteSlotsAction.bind(null, groupId)}
                    className="space-y-3 rounded-lg border border-border bg-surface-subtle p-3"
                  >
                    <input type="hidden" name="deleteMode" value="selected" />
                    <p className="text-sm font-semibold">删除选中的开放时间</p>
                    <label className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Checkbox name="confirmDelete" value="yes" />
                      <span>我确认删除选中且未被引用的开放时间。</span>
                    </label>
                    <Button type="submit" variant="danger" size="sm">
                      删除选中
                    </Button>
                  </form>
                  <form
                    action={deleteSlotsAction.bind(null, groupId)}
                    className="space-y-3 rounded-lg border border-red-200 bg-danger-soft p-3"
                  >
                    <input type="hidden" name="deleteMode" value="clearAll" />
                    <p className="text-sm font-semibold text-danger">清空可删除的开放时间</p>
                    <p className="text-sm leading-6 text-red-800">
                      将删除当前面试组里 {deletableSlotCount}{" "}
                      个未被提交、面试安排或锁定引用的开放时间。
                    </p>
                    <label className="flex items-start gap-2 text-sm text-red-800">
                      <Checkbox name="confirmDelete" value="yes" />
                      <span>我确认清空所有可删除的开放时间。</span>
                    </label>
                    <Button type="submit" variant="danger" size="sm">
                      清空可删除
                    </Button>
                  </form>
                </div>
              </Card>
              <TableContainer>
                <Table>
                  <TableHeader>
                    <tr>
                      <TableHead className="w-12">选择</TableHead>
                      <TableHead>开放时间</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>锁定</TableHead>
                      <TableHead>删除</TableHead>
                      <TableHead>内部原因</TableHead>
                      <TableHead>操作</TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {timeSlots.map((slot) => {
                      const blockedReasons = [
                        slot.submissionSlots.length > 0 ? "候选人提交" : null,
                        slot.appointmentSlots.length > 0 ? "面试安排" : null,
                        slot.activeLock ? "锁定" : null,
                        slot.locks.length > 0 ? "锁定记录" : null
                      ].filter(Boolean);
                      const canDelete = blockedReasons.length === 0;

                      return (
                        <TableRow key={slot.id}>
                          <TableCell>
                            <Checkbox
                              form="deleteSlotsForm"
                              name="slotIds"
                              value={slot.id}
                              disabled={!canDelete}
                              aria-label={`选择开放时间 ${slot.id}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <ZonedDateTimeRange
                              startAt={slot.startAt.toISOString()}
                              endAt={slot.endAt.toISOString()}
                              defaultTimezone={group.timezone}
                            />
                          </TableCell>
                          <TableCell>
                            <StatusBadge kind="slot" status={slot.status} />
                          </TableCell>
                          <TableCell>
                            {slot.activeLock ? (
                              <StatusBadge kind="slot" status="LOCKED" />
                            ) : (
                              <StatusBadge kind="custom" label="未锁定" tone="neutral" />
                            )}
                          </TableCell>
                          <TableCell className="min-w-[150px]">
                            {canDelete ? (
                              <StatusBadge kind="custom" label="可删除" tone="success" />
                            ) : (
                              <div className="space-y-1">
                                <StatusBadge kind="custom" label="保留" tone="warning" />
                                <p className="text-xs leading-5 text-warning">
                                  {blockedReasons.join("、")}
                                </p>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs text-muted-foreground">
                            {slot.activeLock?.reasonInternal ?? slot.internalNote ?? "-"}
                          </TableCell>
                          <TableCell>
                            <form
                              action={updateSlotStatusAction.bind(
                                null,
                                groupId,
                                slot.id,
                                slot.status === "OPEN"
                                  ? GroupTimeSlotStatus.CLOSED
                                  : GroupTimeSlotStatus.OPEN
                              )}
                            >
                              <Button type="submit" variant="secondary" className="h-8 px-3">
                                {slot.status === "OPEN" ? "关闭" : "开放"}
                              </Button>
                            </form>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <PaginationNav
                pathname={`/admin/groups/${groupId}/slots`}
                searchParams={{}}
                itemLabel="个开放时间"
                {...pagination}
              />
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
