import Link from "next/link";
import { Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export type AppointmentInterviewerOption = {
  id: string;
  name: string;
  email: string;
};

export function AppointmentInterviewerPicker({
  interviewers,
  projectId,
  defaultSelectedInterviewerIds = []
}: {
  interviewers: AppointmentInterviewerOption[];
  projectId: string | null;
  defaultSelectedInterviewerIds?: string[];
}) {
  const selectedIds = new Set(defaultSelectedInterviewerIds);

  return (
    <div className="rounded-lg border border-border bg-surface-subtle p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="h-4 w-4 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">面试官</p>
            <p className="mt-1 text-xs text-muted-foreground">
              选择后会检测同一面试官的重叠面试安排。
            </p>
          </div>
        </div>
        {projectId ? (
          <Link
            href={`/admin/projects/${projectId}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            维护面试官池
          </Link>
        ) : null}
      </div>

      {interviewers.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-border bg-white px-3 py-2 text-sm text-muted-foreground">
          当前项目还没有可选面试官。
        </p>
      ) : (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {interviewers.map((interviewer) => (
            <label
              key={interviewer.id}
              className="flex min-h-14 items-start gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm"
            >
              <Checkbox
                name="interviewerIds"
                value={interviewer.id}
                defaultChecked={selectedIds.has(interviewer.id)}
                aria-label={`选择面试官 ${interviewer.name} ${interviewer.email}`}
              />
              <span className="min-w-0">
                <span className="block font-medium">{interviewer.name}</span>
                <span className="mt-1 block break-all text-xs text-muted-foreground">
                  {interviewer.email}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
