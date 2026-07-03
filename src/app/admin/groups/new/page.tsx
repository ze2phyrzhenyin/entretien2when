import { PageHeader } from "@/components/design-system/page-header";
import { AdminShell } from "@/components/layout/admin-shell";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { timezoneOptionsWith } from "@/lib/date/timezone";
import { NewGroupForm } from "./new-group-form";

export default async function NewGroupPage() {
  const admin = await requireAdmin();

  return (
    <AdminShell admin={admin}>
      <PageHeader
        title="创建面试组"
        description="创建后系统会自动生成高强度面试组编号，候选人只能凭正确编号进入。"
      />

      <Card className="max-w-3xl p-6">
        <NewGroupForm timezoneOptions={timezoneOptionsWith("Asia/Shanghai")} />
      </Card>
    </AdminShell>
  );
}
