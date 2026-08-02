"use client";
import { useLocale } from "@/i18n/locale-provider";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";
import { FormField } from "@/components/design-system/form-field";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateGroupAction, type GroupFormState } from "@/server/actions/group";
import type { TimezoneOption } from "@/lib/date/timezone";
import { translateKnownSource } from "@/i18n/catalogs";
type GroupSettingsFormValues = {
  name: string;
  publicDescription: string;
  timezone: string;
  status: "DRAFT" | "OPEN" | "CLOSED" | "ARCHIVED";
  slotDurationMinutes: number;
  interviewDurationMinutes: number;
  minSelectSlots: number;
  maxSelectSlots: number;
};
const initialState: GroupFormState = {};
function SubmitButton() {
  const { t } = useLocale();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full md:w-auto" disabled={pending} isLoading={pending}>
      {pending ? null : <Save className="h-4 w-4" aria-hidden="true" />}
      {pending ? t("legacy.saving.570d6020") : t("legacy.save_settings.c8550237")}
    </Button>
  );
}
export function GroupSettingsForm({
  groupId,
  group,
  timezoneOptions
}: {
  groupId: string;
  group: GroupSettingsFormValues;
  timezoneOptions: TimezoneOption[];
}) {
  const { locale, t } = useLocale();
  const [state, formAction] = useActionState(updateGroupAction.bind(null, groupId), initialState);
  const errors = state.fieldErrors ?? {};
  const localizedError = (message?: string) =>
    message ? translateKnownSource(locale, message) : undefined;
  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <FormField
        id="name"
        label={t("legacy.interview_group_name.6ac47fcf")}
        error={localizedError(errors.name)}
      >
        <Input
          id="name"
          name="name"
          defaultValue={group.name}
          required
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
          defaultValue={group.publicDescription}
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
            defaultValue={group.timezone}
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
            defaultValue={group.status}
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
            defaultValue={group.slotDurationMinutes}
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
            defaultValue={group.interviewDurationMinutes}
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
            defaultValue={group.minSelectSlots}
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
            defaultValue={group.maxSelectSlots}
            aria-invalid={Boolean(errors.maxSelectSlots)}
          />
        </FormField>
      </div>
      {state.message ? (
        <InlineNotice tone={state.status === "success" ? "success" : "danger"}>
          {translateKnownSource(locale, state.message)}
        </InlineNotice>
      ) : null}
      <SubmitButton />
    </form>
  );
}
