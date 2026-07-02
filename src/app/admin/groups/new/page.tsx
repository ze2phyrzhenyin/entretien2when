import { FormField } from "@/components/design-system/form-field";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { PageHeader } from "@/components/design-system/page-header";
import { AdminShell } from "@/components/layout/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth/session";
import { timezoneOptionsWith } from "@/lib/date/timezone";
import { createGroupAction } from "@/server/actions/group";

export default async function NewGroupPage() {
  const admin = await requireAdmin();

  return (
    <AdminShell admin={admin}>
      <PageHeader
        title="创建面试组"
        description="创建后系统会自动生成复杂随机组编号，候选人只能凭正确编号进入。"
      />

      <Card className="max-w-3xl p-6">
        <form action={createGroupAction} className="grid gap-5">
          <FormField id="name" label="组名称">
            <Input id="name" name="name" required placeholder="例如：产品经理一面 7 月批次" />
          </FormField>
          <FormField id="publicDescription" label="公开说明">
            <Textarea
              id="publicDescription"
              name="publicDescription"
              placeholder="候选人可见，例如面试形式、预计时长、注意事项"
            />
          </FormField>
          <div className="grid gap-5 md:grid-cols-2">
            <FormField id="timezone" label="时区">
              <Select id="timezone" name="timezone" defaultValue="Asia/Shanghai">
                {timezoneOptionsWith("Asia/Shanghai").map((timezone) => (
                  <option key={timezone.value} value={timezone.value}>
                    {timezone.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="status" label="状态">
              <Select id="status" name="status" defaultValue="OPEN">
                <option value="DRAFT">草稿</option>
                <option value="OPEN">开放</option>
                <option value="CLOSED">关闭</option>
                <option value="ARCHIVED">归档</option>
              </Select>
            </FormField>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <FormField
              id="slotDurationMinutes"
              label="时间粒度（分钟）"
              description="支持 5 分钟倍数，例如 5、10、15、30。"
            >
              <Input
                id="slotDurationMinutes"
                name="slotDurationMinutes"
                type="number"
                min={5}
                max={180}
                step={5}
                defaultValue={30}
              />
            </FormField>
            <FormField
              id="interviewDurationMinutes"
              label="面试时长（分钟）"
              description="支持 5 分钟倍数，最长 240 分钟。"
            >
              <Input
                id="interviewDurationMinutes"
                name="interviewDurationMinutes"
                type="number"
                min={5}
                max={240}
                step={5}
                defaultValue={60}
              />
            </FormField>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <FormField id="minSelectSlots" label="候选人最少选择">
              <Input
                id="minSelectSlots"
                name="minSelectSlots"
                type="number"
                min={1}
                max={100}
                defaultValue={1}
              />
            </FormField>
            <FormField id="maxSelectSlots" label="候选人最多选择">
              <Input
                id="maxSelectSlots"
                name="maxSelectSlots"
                type="number"
                min={1}
                max={100}
                defaultValue={6}
              />
            </FormField>
          </div>
          <InlineNotice tone="info">
            组编号不能手工输入弱编号。创建成功后，请在设置页复制组编号或候选人链接。
          </InlineNotice>
          <Button type="submit" className="w-full md:w-auto">
            创建面试组
          </Button>
        </form>
      </Card>
    </AdminShell>
  );
}
