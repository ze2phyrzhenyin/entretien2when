import { LoadingState } from "@/components/ui/loading-state";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4">
      <LoadingState title="正在加载页面" description="请稍候。" className="w-full" />
    </main>
  );
}
