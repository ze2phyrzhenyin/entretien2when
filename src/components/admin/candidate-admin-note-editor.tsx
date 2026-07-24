import { AdminOnlyNotice } from "@/components/design-system/admin-only-notice";
import { SectionHeader } from "@/components/design-system/section-header";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";

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
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <Card className="p-5" variant="flat">
      <SectionHeader title="管理员跟进备注" description="仅管理员可见，用于记录内部跟进信息。" />
      <AdminOnlyNotice />
      <form action={action} className="mt-4 space-y-3">
        <Textarea name="body" defaultValue={defaultValue ?? ""} placeholder="填写内部跟进备注" />
        <SubmitButton variant="secondary" className="w-full" pendingText="正在保存">
          保存跟进备注
        </SubmitButton>
      </form>
      <div className="mt-5 space-y-3">
        {notes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface-subtle p-3 text-sm text-muted-foreground">
            暂无管理员跟进备注。
          </p>
        ) : (
          notes.map((note) => (
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
