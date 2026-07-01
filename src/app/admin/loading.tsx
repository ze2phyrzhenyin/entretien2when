import { LoadingState } from "@/components/ui/loading-state";

export default function AdminLoading() {
  return (
    <main className="min-h-screen bg-surface-subtle px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <LoadingState title="正在加载后台" description="正在读取面试组和候选人数据。" />
      </div>
    </main>
  );
}
