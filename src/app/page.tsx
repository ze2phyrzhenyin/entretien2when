import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-surface-subtle px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-center">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
            面试时间协调系统
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            面向候选人隐私隔离、修改审核和面试安排的专业协作工具。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/join">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                提交可用时间
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/login">管理员登录</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
