import { AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { normalizeGroupCode } from "@/lib/group-code/generate";

type CandidateGroupPageProps = {
  params: Promise<{
    groupCode: string;
  }>;
  searchParams: Promise<{
    name?: string;
    email?: string;
  }>;
};

export default async function CandidateGroupPage({
  params,
  searchParams
}: CandidateGroupPageProps) {
  const [{ groupCode }, query] = await Promise.all([params, searchParams]);
  const normalizedGroupCode = normalizeGroupCode(groupCode);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <Card className="p-6 sm:p-8">
          <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-primary">候选人时间选择</p>
          <h1 className="mt-2 text-2xl font-semibold">时间选择流程将在 P0.4 接入</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            当前已完成入口校验和隐私文案。后续会在此页面加载面试组公开说明、候选人身份和可选择时间格。
          </p>
          <dl className="mt-6 grid gap-3 rounded-md border border-border bg-slate-50 p-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">面试组编号</dt>
              <dd className="mt-1 font-mono text-xs font-medium">{normalizedGroupCode}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">姓名</dt>
              <dd className="mt-1 font-medium">{query.name || "未填写"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">邮箱</dt>
              <dd className="mt-1 break-all font-medium">{query.email || "未填写"}</dd>
            </div>
          </dl>
          <div className="mt-6 rounded-md border border-teal-100 bg-teal-50 px-3 py-3 text-sm leading-6 text-teal-900">
            提交后如需修改，修改需要管理员审核；审核通过前仍以旧版本为准。
          </div>
        </Card>
      </div>
    </main>
  );
}
