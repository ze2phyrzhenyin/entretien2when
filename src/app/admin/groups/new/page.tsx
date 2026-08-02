import { getServerTranslator } from "@/i18n/server";
import { PageHeader } from "@/components/design-system/page-header";
import { AdminShell } from "@/components/layout/admin-shell";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { timezoneOptionsWith } from "@/lib/date/timezone";
import { requireSuperAdmin } from "@/lib/permissions/admin";
import { prisma } from "@/lib/db/prisma";
import { NewGroupForm } from "./new-group-form";
export default async function NewGroupPage() {
  const { t } = await getServerTranslator();
  const admin = await requireAdmin();
  requireSuperAdmin(admin);
  const projects = await prisma.interviewProject.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      rounds: {
        where: { status: "ACTIVE" },
        orderBy: { orderIndex: "asc" },
        select: { id: true, name: true, orderIndex: true }
      }
    }
  });
  return (
    <AdminShell admin={admin}>
      <PageHeader
        title={t("legacy.create_interview_group.b24fbbc5")}
        description={t(
          "legacy.after_creation_the_system_will_automatically_generate_a_high_intensity_i.3a6b2bdd"
        )}
      />

      <Card className="max-w-3xl p-6">
        <NewGroupForm timezoneOptions={timezoneOptionsWith("Asia/Shanghai")} projects={projects} />
      </Card>
    </AdminShell>
  );
}
