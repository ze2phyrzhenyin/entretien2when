import Link from "next/link";
import { getConfiguredBasePath, withBasePath } from "@/lib/app-url";
import { isCandidateToken } from "@/lib/auth/candidate-token";
import { CandidateShell } from "@/components/layout/candidate-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type CandidateAuthConfirmationPageProps = {
  params: Promise<{ token: string }>;
};

export default async function CandidateAuthConfirmationPage({
  params
}: CandidateAuthConfirmationPageProps) {
  const { token } = await params;

  if (!isCandidateToken(token)) {
    return (
      <CandidateShell size="narrow">
        <Card className="mx-auto max-w-lg p-6">
          <h1 className="text-xl font-semibold">访问链接无效</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            此链接格式不正确。请从招聘方发送的邮件中重新打开访问链接。
          </p>
          <Link className="mt-5 inline-flex text-sm font-medium text-primary" href="/join">
            返回填写入口
          </Link>
        </Card>
      </CandidateShell>
    );
  }

  const postPath = withBasePath(
    `/candidate/auth/${encodeURIComponent(token)}`,
    getConfiguredBasePath()
  );

  return (
    <CandidateShell size="narrow">
      <Card className="mx-auto max-w-lg p-6">
        <h1 className="text-xl font-semibold">确认进入候选人页面</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          为避免邮箱安全扫描器提前使用链接，请确认由你本人打开后再继续。该访问链接只能使用一次。
        </p>
        <form action={postPath} method="post" className="mt-5">
          <Button type="submit" className="w-full">
            继续进入
          </Button>
        </form>
      </Card>
    </CandidateShell>
  );
}
