import { AdminRole, AdminStatus } from "@prisma/client";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { PageHeader } from "@/components/design-system/page-header";
import { AdminShell } from "@/components/layout/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/permissions/admin";
import {
  createAdminAction,
  resetAdminPasswordAction,
  updateAdminAction
} from "@/server/actions/admin-management";

type AdminsPageProps = {
  searchParams: Promise<{ admin?: string }>;
};

const statusMessage: Record<string, { tone: "success" | "warning" | "danger"; text: string }> = {
  created: { tone: "success", text: "管理员已创建。" },
  updated: { tone: "success", text: "管理员角色和状态已更新。" },
  "password-reset": { tone: "success", text: "密码已重置，原有登录会话已撤销。" },
  duplicate: { tone: "warning", text: "该邮箱已经存在管理员账号。" },
  "last-owner": { tone: "danger", text: "不能停用某个面试组最后一个有效 OWNER。" },
  "last-super-admin": { tone: "danger", text: "不能停用或降级最后一个有效超级管理员。" },
  invalid: { tone: "warning", text: "管理员信息不完整或格式不正确。" },
  "invalid-password": { tone: "warning", text: "新密码至少需要 12 个字符。" }
};

export default async function AdminsPage({ searchParams }: AdminsPageProps) {
  const [actor, query] = await Promise.all([requireAdmin(), searchParams]);
  requireSuperAdmin(actor);
  const admins = await prisma.admin.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { groupMemberships: true, sessions: true } }
    }
  });
  const notice = query.admin ? statusMessage[query.admin] : null;

  return (
    <AdminShell admin={actor} active="admins">
      <PageHeader
        title="管理员与全局角色"
        description="创建管理员、调整全局角色和状态，或安全重置密码。面试组角色在各组的“成员与角色”页维护。"
      />
      {notice ? (
        <InlineNotice tone={notice.tone} className="mb-5">
          {notice.text}
        </InlineNotice>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {admins.map((admin) => (
            <Card key={admin.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{admin.displayName}</p>
                  <p className="mt-1 break-all text-sm text-muted-foreground">{admin.email}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {admin._count.groupMemberships} 个组角色 · {admin._count.sessions}{" "}
                    个有效记录会话
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-xs">{admin.status}</span>
              </div>
              <form
                action={updateAdminAction}
                className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <input type="hidden" name="adminId" value={admin.id} />
                <Select
                  name="role"
                  defaultValue={admin.role}
                  aria-label={`${admin.email} 全局角色`}
                >
                  <option value={AdminRole.ADMIN}>组级管理员</option>
                  <option value={AdminRole.SUPER_ADMIN}>超级管理员</option>
                </Select>
                <Select
                  name="status"
                  defaultValue={admin.status}
                  aria-label={`${admin.email} 账号状态`}
                >
                  <option value={AdminStatus.ACTIVE}>启用</option>
                  <option value={AdminStatus.DISABLED}>停用</option>
                </Select>
                <SubmitButton variant="secondary">保存</SubmitButton>
              </form>
              <details className="mt-4 rounded-md border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">重置密码并撤销会话</summary>
                <ConfirmForm
                  action={resetAdminPasswordAction}
                  confirmMessage={`确认重置 ${admin.email} 的密码并撤销全部登录会话？`}
                  className="mt-3 flex flex-col gap-3 sm:flex-row"
                >
                  <input type="hidden" name="adminId" value={admin.id} />
                  <Input
                    name="password"
                    type="password"
                    minLength={12}
                    autoComplete="new-password"
                    placeholder="至少 12 个字符"
                    required
                  />
                  <Button type="submit" variant="danger">
                    重置密码
                  </Button>
                </ConfirmForm>
              </details>
            </Card>
          ))}
        </div>

        <Card className="h-fit p-5">
          <h2 className="text-lg font-semibold">创建管理员</h2>
          <form action={createAdminAction} className="mt-4 grid gap-4">
            <div>
              <Label htmlFor="displayName">姓名</Label>
              <Input id="displayName" name="displayName" required />
            </div>
            <div>
              <Label htmlFor="email">邮箱</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="password">初始密码</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={12}
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <Label htmlFor="role">全局角色</Label>
              <Select id="role" name="role" defaultValue={AdminRole.ADMIN}>
                <option value={AdminRole.ADMIN}>组级管理员</option>
                <option value={AdminRole.SUPER_ADMIN}>超级管理员</option>
              </Select>
            </div>
            <SubmitButton className="w-full">创建管理员</SubmitButton>
          </form>
        </Card>
      </div>
    </AdminShell>
  );
}
