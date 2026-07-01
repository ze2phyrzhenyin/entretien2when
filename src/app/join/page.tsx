import { LockKeyhole } from "lucide-react";
import { Card } from "@/components/ui/card";
import { JoinForm } from "./join-form";

export default function JoinPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center">
        <Card className="w-full p-6 sm:p-8">
          <div className="mb-6">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-primary">
              <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-semibold">填写面试时间</h1>
          </div>

          <JoinForm />
        </Card>
      </div>
    </main>
  );
}
