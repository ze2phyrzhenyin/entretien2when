"use client";
import { useLocale } from "@/i18n/locale-provider";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { FormField } from "@/components/design-system/form-field";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { translateKnownSource } from "@/i18n/catalogs";
import { isValidGroupCode, normalizeGroupCode } from "@/lib/group-code/generate";
import {
  requestCandidateAccessAction,
  type CandidateAccessRequestState
} from "@/server/actions/candidate";
const initialState: CandidateAccessRequestState = {};
function SubmitButton({ disabled }: { disabled: boolean }) {
  const { t } = useLocale();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending || disabled} isLoading={pending}>
      {pending ? t("legacy.sending_access_link.f3425f54") : t("legacy.send_access_link.685a3d8b")}
    </Button>
  );
}
export function JoinForm() {
  const { locale, t } = useLocale();
  const [state, formAction] = useActionState(requestCandidateAccessAction, initialState);
  const [groupCode, setGroupCode] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const formData = new FormData(event.currentTarget);
        const normalizedCode = normalizeGroupCode(String(formData.get("groupCode") ?? ""));
        if (!isValidGroupCode(normalizedCode)) {
          setClientError(
            t("legacy.please_enter_a_complete_and_valid_interview_group_number.29c8cbf4")
          );
          event.preventDefault();
          return;
        }
        setClientError(null);
      }}
      className="space-y-5"
      noValidate
    >
      <div>
        <FormField
          id="name"
          label={t("legacy.name.50b5b1d2")}
          description={t(
            "legacy.please_fill_in_the_name_consistent_with_the_interview_communication.7ee8521e"
          )}
        >
          <Input
            id="name"
            name="name"
            autoComplete="name"
            placeholder={t("legacy.please_enter_name.c59d0536")}
            required
          />
        </FormField>
      </div>

      <FormField id="email" label={t("legacy.email.73075237")}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          required
        />
      </FormField>

      <FormField id="groupCode" label={t("legacy.interview_group_number.56682195")}>
        <Input
          id="groupCode"
          name="groupCode"
          autoCapitalize="characters"
          inputMode="text"
          placeholder="K7Q9-M2TD-8F6P-W4ZX-N3CY"
          required
          value={groupCode}
          onChange={(event) => {
            setGroupCode(normalizeGroupCode(event.target.value));
            setClientError(null);
          }}
        />
      </FormField>

      {clientError ? <InlineNotice tone="danger">{clientError}</InlineNotice> : null}
      {state.status === "error" && state.message ? (
        <InlineNotice tone="danger">{translateKnownSource(locale, state.message)}</InlineNotice>
      ) : null}
      {state.status === "success" && state.message ? (
        <InlineNotice tone="success">
          <span>{translateKnownSource(locale, state.message)}</span>
          {state.previewHref ? (
            <a className="ml-2 font-medium text-primary" href={state.previewHref}>
              {t("legacy.open_test_access_link.cb64d462")}
            </a>
          ) : null}
        </InlineNotice>
      ) : null}

      <SubmitButton disabled={Boolean(clientError)} />
    </form>
  );
}
