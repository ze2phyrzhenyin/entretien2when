import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4">
      <ErrorState
        title="页面不存在"
        description="请检查链接是否正确。"
        className="w-full"
        action={
          <Button asChild>
            <Link href="/join">返回入口</Link>
          </Button>
        }
      />
    </main>
  );
}
