import { GroupTimeSlotStatus } from "@prisma/client";
import { AdminShell } from "@/components/layout/admin-shell";
import { GroupAdminNav } from "@/components/layout/group-admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">开放时间配置</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          按面试组时区生成时间段。管理员端可见关闭、锁定和内部原因；候选人端只会看到不可选。
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="p-5">
          <h3 className="font-semibold">批量生成时间段</h3>
          <form action={batchGenerateSlotsAction.bind(null, groupId)} className="mt-4 space-y-4">
            <div>
              <Label htmlFor="dateFrom">开始日期</Label>
              <Input id="dateFrom" name="dateFrom" type="date" required />
            </div>
            <div>
              <Label htmlFor="dateTo">结束日期</Label>
              <Input id="dateTo" name="dateTo" type="date" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="startTime">开始时间</Label>
                <Input id="startTime" name="startTime" type="time" defaultValue="09:00" required />
              </div>
              <div>
                <Label htmlFor="endTime">结束时间</Label>
                <Input id="endTime" name="endTime" type="time" defaultValue="18:00" required />
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">星期</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {weekdayOptions.map(([value, label]) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 rounded-md border border-border p-2"
                  >
                    <input
                      name="weekdays"
                      type="checkbox"
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
          {group.timeSlots.length === 0 ? (
            <EmptyState
              title="还没有开放时间"
              description="先用左侧表单批量生成时间段。候选人只能在已开放且未锁定的时间中选择。"
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-white">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">时间</th>
                    <th className="px-4 py-3">状态</th>
                    <th className="px-4 py-3">锁定</th>
                    <th className="px-4 py-3">内部原因</th>
                    <th className="px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {group.timeSlots.map((slot) => (
                    <tr key={slot.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">
                        {formatDateTimeRange(slot.startAt, slot.endAt, group.timezone)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={slot.status === "OPEN" ? "success" : "neutral"}>
                          {slot.status === "OPEN" ? "开放" : "关闭"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {slot.activeLock ? (
                          <Badge tone="warning">已锁定</Badge>
                        ) : (
                          <Badge>未锁定</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {slot.activeLock?.reasonInternal ?? slot.internalNote ?? "-"}
                      </td>
                      <td className="px-4 py-3">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
