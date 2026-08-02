import { getServerTranslator } from "@/i18n/server";
import Link from "next/link";
import { Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
export type AppointmentInterviewerOption = {
  id: string;
  name: string;
  email: string;
};
export async function AppointmentInterviewerPicker({
  interviewers,
  projectId,
  defaultSelectedInterviewerIds = []
}: {
  interviewers: AppointmentInterviewerOption[];
  projectId: string | null;
  defaultSelectedInterviewerIds?: string[];
}) {
  const { t } = await getServerTranslator();
  const selectedIds = new Set(defaultSelectedInterviewerIds);
  return (
    <div className="rounded-lg border border-border bg-surface-subtle p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="h-4 w-4 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">{t("legacy.interviewers.5e6ecb10")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(
                "legacy.after_selection_overlapping_interview_schedules_with_the_same_interviewe.700acbb1"
              )}
            </p>
          </div>
        </div>
        {projectId ? (
          <Link
            href={`/admin/projects/${projectId}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            {t("legacy.maintain_interviewer_pool.63bd09e0")}
          </Link>
        ) : null}
      </div>

      {interviewers.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-border bg-white px-3 py-2 text-sm text-muted-foreground">
          {t("legacy.there_are_currently_no_interviewers_available_for_this_project.462e1f82")}
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
                aria-label={t("legacy.select_interviewer_value0_value1.85b0e461", {
                  value0: interviewer.name,
                  value1: interviewer.email
                })}
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
