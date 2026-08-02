import { getServerTranslator } from "@/i18n/server";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/layout/auth-layout";
import { getCurrentAdmin } from "@/lib/auth/session";
import { AdminLoginForm } from "./login-form";
export default async function AdminLoginPage() {
  const { t } = await getServerTranslator();
  const admin = await getCurrentAdmin();
  if (admin) {
    redirect("/admin");
  }
  return (
    <AuthLayout>
      <div className="mb-6">
        <p className="text-sm font-medium text-primary">{t("legacy.administration.ed498fef")}</p>
        <h1 className="mt-2 text-2xl font-semibold">
          {t("legacy.administrator_sign_in.c454c61e")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t(
            "legacy.after_logging_in_you_can_manage_interview_groups_review_candidate_modifi.4566ac83"
          )}
        </p>
      </div>
      <AdminLoginForm />
    </AuthLayout>
  );
}
