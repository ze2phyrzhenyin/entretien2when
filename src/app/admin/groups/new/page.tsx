import { AdminShell } from "@/components/layout/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth/session";
import { createGroupAction } from "@/server/actions/group";

export default async function NewGroupPage() {
  const admin = await requireAdmin();

  return (
    <AdminShell admin={admin}>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">创建面试组</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          创建后系统会自动生成复杂随机组编号，候选人只能凭正确编号进入。
        </p>
      </div>

      <Card className="max-w-3xl p-6">
        <form action={createGroupAction} className="grid gap-5">
          <div>
            <Label htmlFor="name">组名称</Label>
            <Input id="name" name="name" required placeholder="例如：产品经理一面 7 月批次" />
          </div>
          <div>
            <Label htmlFor="publicDescription">公开说明</Label>
            <Textarea
              id="publicDescription"
              name="publicDescription"
              placeholder="候选人可见，例如面试形式、预计时长、注意事项"
            />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <Label htmlFor="timezone">时区</Label>
              <Input id="timezone" name="timezone" defaultValue="Asia/Shanghai" required />
            </div>
            <div>
              <Label htmlFor="status">状态</Label>
              <Select id="status" name="status" defaultValue="OPEN">
                <option value="DRAFT">草稿</option>
                <option value="OPEN">开放</option>
                <option value="CLOSED">关闭</option>
                <option value="ARCHIVED">归档</option>
              </Select>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <Label htmlFor="slotDurationMinutes">时间粒度（分钟）</Label>
              <Input
                id="slotDurationMinutes"
                name="slotDurationMinutes"
                type="number"
                defaultValue={30}
              />
            </div>
            <div>
              <Label htmlFor="interviewDurationMinutes">面试时长（分钟）</Label>
              <Input
                id="interviewDurationMinutes"
                name="interviewDurationMinutes"
                type="number"
                defaultValue={60}
              />
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <Label htmlFor="minSelectSlots">候选人最少选择</Label>
              <Input id="minSelectSlots" name="minSelectSlots" type="number" defaultValue={1} />
            </div>
            <div>
              <Label htmlFor="maxSelectSlots">候选人最多选择</Label>
              <Input id="maxSelectSlots" name="maxSelectSlots" type="number" defaultValue={6} />
            </div>
          </div>
          <div className="rounded-md border border-teal-100 bg-teal-50 px-3 py-3 text-sm leading-6 text-teal-900">
            组编号不能手工输入弱编号。创建成功后，请在设置页复制组编号或候选人链接。
          </div>
          <Button type="submit" className="w-full md:w-auto">
            创建面试组
          </Button>
        </form>
      </Card>
    </AdminShell>
  );
}
