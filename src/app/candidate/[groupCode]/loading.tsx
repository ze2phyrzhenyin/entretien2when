import { LoadingState } from "@/components/ui/loading-state";

export default function CandidateLoading() {
  return (
    <main className="min-h-screen bg-surface-subtle px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <LoadingState title="正在加载面试组" description="正在读取你的提交状态。" />
      </div>
    </main>
  );
}
