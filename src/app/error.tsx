"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

export default function RootError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4">
      <ErrorState
        title="页面加载失败"
        description="请稍后重试，或返回上一页。"
        className="w-full"
        action={<Button onClick={reset}>重试</Button>}
      />
    </main>
  );
}
