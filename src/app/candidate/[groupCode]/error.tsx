"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

export default function CandidateError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-surface-subtle px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <ErrorState
          title="候选人页面加载失败"
          description="请检查组编号是否正确，或稍后重试。"
          action={<Button onClick={reset}>重试</Button>}
        />
      </div>
    </main>
  );
}
