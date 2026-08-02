"use client";
import { useLocale } from "@/i18n/locale-provider";
import { useActionState } from "react";
import { AdminOnlyNotice } from "@/components/design-system/admin-only-notice";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { SectionHeader } from "@/components/design-system/section-header";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { translateKnownSource } from "@/i18n/catalogs";
import type { CandidateAdminNoteState } from "@/server/actions/admin-note";
type AdminNote = {
  id: string;
  body: string;
  authorName: string;
  authorEmail?: string;
};
export function CandidateAdminNoteEditor({
  defaultValue,
  notes,
  action
}: {
  defaultValue?: string | null;
  notes: AdminNote[];
  action: (
    previousState: CandidateAdminNoteState,
    formData: FormData
  ) => Promise<CandidateAdminNoteState>;
}) {
  const { locale, t } = useLocale();
  const [state, formAction] = useActionState(action, {});
  const displayedNotes = state.note
    ? [state.note, ...notes.filter((note) => note.id !== state.note?.id)]
    : notes;
  return (
    <Card className="p-5" variant="flat">
      <SectionHeader
        title={t("legacy.administrator_follow_up_notes.a49ca10e")}
        description={t(
          "legacy.visible_only_to_administrators_used_to_record_internal_follow_up_informa.87d09e8c"
        )}
      />
      <AdminOnlyNotice />
      <form action={formAction} className="mt-4 space-y-3">
        <Textarea
          name="body"
          defaultValue={defaultValue ?? ""}
          placeholder={t("legacy.fill_in_internal_follow_up_notes.5cc1cf80")}
        />
        <SubmitButton
          variant="secondary"
          className="w-full"
          pendingText={t("legacy.saving.570d6020")}
        >
          {t("legacy.save_follow_up_notes.90929bf8")}
        </SubmitButton>
      </form>
      {state.message ? (
        <InlineNotice tone={state.status === "error" ? "danger" : "success"} className="mt-4">
          {translateKnownSource(locale, state.message)}
        </InlineNotice>
      ) : null}
      <div className="mt-5 space-y-3">
        {displayedNotes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface-subtle p-3 text-sm text-muted-foreground">
            {t("legacy.there_is_currently_no_follow_up_comment_from_the_administrator.df76574a")}
          </p>
        ) : (
          displayedNotes.map((note) => (
            <div
              key={note.id}
              className="rounded-lg border border-border bg-surface-subtle p-3 text-sm"
            >
              <p className="whitespace-pre-wrap leading-6">{note.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {note.authorEmail ? `${note.authorName} · ${note.authorEmail}` : note.authorName}
              </p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
