import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { AdminRole } from "@prisma/client";
import { AdminShell } from "@/components/layout/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();
  const groups = await prisma.interviewGroup.findMany({
    where:
      admin.role === AdminRole.SUPER_ADMIN
        ? undefined
        : {
            groupAdmins: {
              some: {
                adminId: admin.id
              }
            }
          },
    orderBy: {
      createdAt: "desc"
    },
    take: 20,
    include: {
      _count: {
        select: {
          candidates: true,
          appointments: true,
          submissions: true
        }
      }
    }
  });

  return (
    <AdminShell admin={admin}>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-2xl font-semibold">面试组</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            超级管理员可查看全部组；普通管理员只会看到被授权的面试组。
          </p>
        </div>
        <Button className="w-full gap-2 sm:w-auto">
          <Plus className="h-4 w-4" aria-hidden="true" />
          创建面试组
        </Button>
      </div>

      <div className="mb-4 flex h-11 items-center rounded-md border border-border bg-white px-3 text-sm text-muted-foreground">
        <Search className="mr-2 h-4 w-4" aria-hidden="true" />
        搜索会在 P0.2 面试组管理中启用
      </div>

      {groups.length === 0 ? (
        <Card className="p-10 text-center">
          <h3 className="text-lg font-semibold">还没有面试组</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            创建面试组后，系统会自动生成复杂随机组编号并提供候选人链接。
          </p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3">组名称</th>
                <th className="px-4 py-3">组编号</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">候选人</th>
                <th className="px-4 py-3">预约</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{group.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{group.groupCode}</td>
                  <td className="px-4 py-3">{group.status}</td>
                  <td className="px-4 py-3">{group._count.candidates}</td>
                  <td className="px-4 py-3">{group._count.appointments}</td>
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-primary"
                      href={`/admin/groups/${group.id}/settings`}
                    >
                      查看
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
