import Link from "next/link";
import { CalendarDays } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-center">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-semibold leading-tight text-slate-950 md:text-5xl">
            中文版面试时间管理系统
          </h1>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/join"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-teal-800 sm:w-auto"
            >
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              填写面试时间
            </Link>
            <Link
              href="/admin/login"
              className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-white px-4 text-sm font-medium hover:bg-slate-50"
            >
              管理员登录
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
