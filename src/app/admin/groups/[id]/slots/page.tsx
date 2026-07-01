import { GroupTimeSlotStatus } from "@prisma/client";
import { FormField } from "@/components/design-system/form-field";
import { PageHeader } from "@/components/design-system/page-header";
import { SectionHeader } from "@/components/design-system/section-header";
import { StatusBadge } from "@/components/design-system/status-badge";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupAdminNav } from "@/components/layout/group-admin-nav";
import { AdminSlotLegend } from "@/components/scheduling/slot-legend";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
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
import { formatDateTimeRange } from "@/lib/date/timezone";
import { prisma } from "@/lib/db/prisma";
import { canAccessGroup } from "@/lib/permissions/admin";
import { batchGenerateSlotsAction, updateSlotStatusAction } from "@/server/actions/slot";

type SlotsPageProps = {
  params: Promise<{ id: string }>;
};

const weekdayOptions = [
  ["1", "周一"],
  ["2", "周二"],
  ["3", "周三"],
  ["4", "周四"],
  ["5", "周五"],
  ["6", "周六"],
  ["0", "周日"]
] as const;

export default async function GroupSlotsPage({ params }: SlotsPageProps) {
  const { id: groupId } = await params;
  const admin = await requireAdmin();
  const allowed = await canAccessGroup(admin, groupId);

  if (!allowed) {
    throw new Error("没有权限访问该面试组。");
  }

  const group = await prisma.interviewGroup.findUniqueOrThrow({
    where: { id: groupId },
    include: {
      timeSlots: {
        orderBy: { startAt: "asc" },
        include: {
          activeLock: true
        }
      }
    }
  });

  return (
    <AdminShell admin={admin}>
      <GroupAdminNav groupId={groupId} active="slots" />
      <PageHeader
        title="开放时间配置"
        description="按面试组时区生成时间段。管理员端可见关闭、锁定和内部原因；候选人端只会看到不可选。"
      />

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="p-5">
          <SectionHeader title="批量生成时间段" description={`当前时区：${group.timezone}`} />
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
            <div>
              <p className="mb-2 text-sm font-medium">星期</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {weekdayOptions.map(([value, label]) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 rounded-md border border-border p-2"
                  >
                    <Checkbox
                      name="weekdays"
                      value={value}
                      defaultChecked={value !== "0" && value !== "6"}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full">
              生成时间段
            </Button>
          </form>
        </Card>

        <div>
          <div className="mb-4">
            <AdminSlotLegend />
          </div>
          {group.timeSlots.length === 0 ? (
            <EmptyState
              title="还没有开放时间"
              description="先用左侧表单批量生成时间段。候选人只能在已开放且未锁定的时间中选择。"
            />
          ) : (
            <TableContainer>
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead>时间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>锁定</TableHead>
                    <TableHead>内部原因</TableHead>
                    <TableHead>操作</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {group.timeSlots.map((slot) => (
                    <TableRow key={slot.id}>
                      <TableCell className="font-medium">
                        {formatDateTimeRange(slot.startAt, slot.endAt, group.timezone)}
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
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
