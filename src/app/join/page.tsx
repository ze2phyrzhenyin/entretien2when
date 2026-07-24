import { LockKeyhole } from "lucide-react";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { PrivacyNotice } from "@/components/design-system/privacy-notice";
import { CenteredCardLayout } from "@/components/layout/centered-card-layout";
import { JoinForm } from "./join-form";

type JoinPageProps = {
  searchParams: Promise<{ access?: string }>;
};

function accessNotice(access?: string) {
  if (access === "invalid") {
    return "访问链接无效或已过期，请重新发送访问链接。";
  }
  if (access === "required") {
    return "请先通过邮箱访问链接进入候选人页面。";
  }
  if (access === "group-not-open") {
    return "面试组不存在或暂未开放。";
  }
  return null;
}

export default async function JoinPage({ searchParams }: JoinPageProps) {
  const query = await searchParams;
  const notice = accessNotice(query.access);

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

      {notice ? (
        <InlineNotice tone="warning" className="mb-5">
          {notice}
        </InlineNotice>
      ) : null}

      <JoinForm />

      <div className="mt-5">
        <PrivacyNotice />
      </div>
    </CenteredCardLayout>
  );
}
