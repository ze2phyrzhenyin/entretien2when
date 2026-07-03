import { LockKeyhole } from "lucide-react";
import { PrivacyNotice } from "@/components/design-system/privacy-notice";
import { CenteredCardLayout } from "@/components/layout/centered-card-layout";
import { JoinForm } from "./join-form";

export default function JoinPage() {
  return (
    <CenteredCardLayout>
      <div className="mb-6">
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <LockKeyhole className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold">提交可用时间</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          请输入姓名、邮箱和面试组编号，进入对应的时间选择页面。
        </p>
      </div>

      <JoinForm />

      <div className="mt-5">
        <PrivacyNotice />
      </div>
    </CenteredCardLayout>
  );
}
