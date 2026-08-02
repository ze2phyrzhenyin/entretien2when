"use client";
import { useLocale } from "@/i18n/locale-provider";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { FormField } from "@/components/design-system/form-field";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createGroupAction, type GroupFormState } from "@/server/actions/group";
import type { TimezoneOption } from "@/lib/date/timezone";
import { translateKnownSource } from "@/i18n/catalogs";
const initialState: GroupFormState = {};
function SubmitButton() {
  const { t } = useLocale();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full md:w-auto" disabled={pending} isLoading={pending}>
      {pending ? null : <Plus className="h-4 w-4" aria-hidden="true" />}
      {pending ? t("legacy.creating.0bdce99a") : t("legacy.create_interview_group.b24fbbc5")}
    </Button>
  );
}
type ProjectOption = {
  id: string;
  name: string;
  rounds: Array<{
    id: string;
    name: string;
    orderIndex: number;
  }>;
};
export function NewGroupForm({
  timezoneOptions,
  projects
}: {
  timezoneOptions: TimezoneOption[];
  projects: ProjectOption[];
}) {
  const { locale, t } = useLocale();
  const [state, formAction] = useActionState(createGroupAction, initialState);
  const [projectId, setProjectId] = useState("");
  const errors = state.fieldErrors ?? {};
  const rounds = useMemo(
    () => projects.find((project) => project.id === projectId)?.rounds ?? [],
    [projectId, projects]
  );
  const localizedError = (message?: string) =>
    message ? translateKnownSource(locale, message) : undefined;
  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <div className="rounded-lg border border-border bg-surface-subtle p-4">
        <p className="font-medium">{t("legacy.projects_and_rounds.b93e1407")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            "legacy.you_can_create_a_new_project_or_add_this_interview_group_to_existing_pro.01220e90"
          )}
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FormField id="projectId" label={t("legacy.recruitment_projects.3e10026b")}>
            <Select
              id="projectId"
              name="projectId"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">{t("legacy.create_new_project_and_default_rounds.31e18c2d")}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="roundId" label={t("legacy.round.4890584b")}>
            <Select id="roundId" name="roundId" disabled={!projectId} required={Boolean(projectId)}>
              <option value="">
                {projectId
                  ? t("legacy.select_rounds.9def48c2")
                  : t("legacy.default_rounds_will_be_created_automatically.d52115d9")}
              </option>
              {rounds.map((round) => (
                <option key={round.id} value={round.id}>
                  {round.orderIndex}. {round.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </div>
      <FormField
        id="name"
        label={t("legacy.interview_group_name.6ac47fcf")}
        error={localizedError(errors.name)}
      >
        <Input
          id="name"
          name="name"
          required
          placeholder={t("legacy.for_example_product_manager_s_july_batch.1b594233")}
          aria-invalid={Boolean(errors.name)}
        />
      </FormField>
      <FormField
        id="publicDescription"
        label={t("legacy.candidate_visible_instructions.4fb1e953")}
        error={localizedError(errors.publicDescription)}
      >
        <Textarea
          id="publicDescription"
          name="publicDescription"
          placeholder={t(
            "legacy.visible_to_candidates_such_as_interview_format_expected_duration_and_pre.239e8869"
          )}
          aria-invalid={Boolean(errors.publicDescription)}
        />
      </FormField>
      <div className="grid gap-5 md:grid-cols-2">
        <FormField
          id="timezone"
          label={t("legacy.time_zone.b5d72c5c")}
          error={localizedError(errors.timezone)}
        >
          <Select
            id="timezone"
            name="timezone"
            defaultValue="Asia/Shanghai"
            aria-invalid={Boolean(errors.timezone)}
          >
            {timezoneOptions.map((timezone) => (
              <option key={timezone.value} value={timezone.value}>
                {timezone.labelKey ? t(timezone.labelKey) : timezone.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          id="status"
          label={t("legacy.status.6320b4a8")}
          error={localizedError(errors.status)}
        >
          <Select
            id="status"
            name="status"
            defaultValue="OPEN"
            aria-invalid={Boolean(errors.status)}
          >
            <option value="DRAFT">{t("legacy.draft.2a2fd29b")}</option>
            <option value="OPEN">{t("legacy.open.c14c915d")}</option>
            <option value="CLOSED">{t("legacy.close.3fd47edc")}</option>
            <option value="ARCHIVED">{t("legacy.archived.5292ab1a")}</option>
          </Select>
        </FormField>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <FormField
          id="slotDurationMinutes"
          label={t("legacy.time_granularity_minutes.45c97115")}
          description={t("legacy.the_smallest_unit_of_time_a_candidate_can_select.560bdf71")}
          error={localizedError(errors.slotDurationMinutes)}
        >
          <Input
            id="slotDurationMinutes"
            name="slotDurationMinutes"
            type="number"
            defaultValue={60}
            aria-invalid={Boolean(errors.slotDurationMinutes)}
          />
        </FormField>
        <FormField
          id="interviewDurationMinutes"
          label={t("legacy.interview_duration_minutes.289317ec")}
          description={t(
            "legacy.the_expected_duration_of_the_formal_interview_must_be_shorter_than_the_t.705fbc1a"
          )}
          error={localizedError(errors.interviewDurationMinutes)}
        >
          <Input
            id="interviewDurationMinutes"
            name="interviewDurationMinutes"
            type="number"
            defaultValue={30}
            aria-invalid={Boolean(errors.interviewDurationMinutes)}
          />
        </FormField>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <FormField
          id="minSelectSlots"
          label={t("legacy.minimum_number_of_choices.1098b16b")}
          error={localizedError(errors.minSelectSlots)}
        >
          <Input
            id="minSelectSlots"
            name="minSelectSlots"
            type="number"
            min={1}
            max={100}
            defaultValue={1}
            aria-invalid={Boolean(errors.minSelectSlots)}
          />
        </FormField>
        <FormField
          id="maxSelectSlots"
          label={t("legacy.maximum_number_of_choices.72429439")}
          error={localizedError(errors.maxSelectSlots)}
        >
          <Input
            id="maxSelectSlots"
            name="maxSelectSlots"
            type="number"
            min={1}
            max={100}
            defaultValue={6}
            aria-invalid={Boolean(errors.maxSelectSlots)}
          />
        </FormField>
      </div>
      <InlineNotice tone={state.status === "error" ? "danger" : "info"}>
        {state.message
          ? translateKnownSource(locale, state.message)
          : t(
              "legacy.the_system_will_automatically_generate_a_high_intensity_interview_group_.3b07fc61"
            )}
      </InlineNotice>
      <SubmitButton />
    </form>
  );
}
