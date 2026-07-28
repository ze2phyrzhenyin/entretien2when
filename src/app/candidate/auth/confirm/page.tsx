import Link from "next/link";
import { CandidateShell } from "@/components/layout/candidate-shell";
import { Card } from "@/components/ui/card";
import { CandidateAuthConfirmation } from "./candidate-auth-confirmation";

export const metadata = {
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
    noarchive: true
  }
};

export default function CandidateAuthConfirmationPage() {
  return (
    <CandidateShell size="narrow">
      <Card className="mx-auto max-w-lg p-6">
        <h1 className="text-xl font-semibold">确认进入候选人页面</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          为避免邮箱安全扫描器提前使用链接，请确认由你本人打开后再继续。该访问链接只能使用一次。
        </p>
        <CandidateAuthConfirmation />
        <Link className="mt-5 inline-flex text-sm font-medium text-primary" href="/join">
          返回填写入口
        </Link>
      </Card>
    </CandidateShell>
  );
}
