"use client";

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

type TimezoneOption = {
  value: string;
  label: string;
};

const initialState: GroupFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full md:w-auto" disabled={pending} isLoading={pending}>
      {pending ? null : <Save className="h-4 w-4" aria-hidden="true" />}
      {pending ? "正在保存" : "保存设置"}
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
  const [state, formAction] = useActionState(updateGroupAction.bind(null, groupId), initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <FormField id="name" label="组名称" error={errors.name}>
        <Input
          id="name"
          name="name"
          defaultValue={group.name}
          required
          aria-invalid={Boolean(errors.name)}
        />
      </FormField>
      <FormField id="publicDescription" label="公开说明" error={errors.publicDescription}>
        <Textarea
          id="publicDescription"
          name="publicDescription"
          defaultValue={group.publicDescription}
          aria-invalid={Boolean(errors.publicDescription)}
        />
      </FormField>
      <div className="grid gap-5 md:grid-cols-2">
        <FormField id="timezone" label="时区" error={errors.timezone}>
          <Select
            id="timezone"
            name="timezone"
            defaultValue={group.timezone}
            aria-invalid={Boolean(errors.timezone)}
          >
            {timezoneOptions.map((timezone) => (
              <option key={timezone.value} value={timezone.value}>
                {timezone.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="status" label="状态" error={errors.status}>
          <Select
            id="status"
            name="status"
            defaultValue={group.status}
            aria-invalid={Boolean(errors.status)}
          >
            <option value="DRAFT">草稿</option>
            <option value="OPEN">开放</option>
            <option value="CLOSED">关闭</option>
            <option value="ARCHIVED">归档</option>
          </Select>
        </FormField>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <FormField
          id="slotDurationMinutes"
          label="时间粒度（分钟）"
          description="支持 5 分钟倍数，例如 5、10、15、30。"
          error={errors.slotDurationMinutes}
        >
          <Input
            id="slotDurationMinutes"
            name="slotDurationMinutes"
            type="number"
            min={5}
            max={180}
            step={5}
            defaultValue={group.slotDurationMinutes}
            aria-invalid={Boolean(errors.slotDurationMinutes)}
          />
        </FormField>
        <FormField
          id="interviewDurationMinutes"
          label="面试时长（分钟）"
          description="支持 5 分钟倍数，最长 240 分钟。"
          error={errors.interviewDurationMinutes}
        >
          <Input
            id="interviewDurationMinutes"
            name="interviewDurationMinutes"
            type="number"
            min={5}
            max={240}
            step={5}
            defaultValue={group.interviewDurationMinutes}
            aria-invalid={Boolean(errors.interviewDurationMinutes)}
          />
        </FormField>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <FormField id="minSelectSlots" label="候选人最少选择" error={errors.minSelectSlots}>
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
        <FormField id="maxSelectSlots" label="候选人最多选择" error={errors.maxSelectSlots}>
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
          {state.message}
        </InlineNotice>
      ) : null}
      <SubmitButton />
    </form>
  );
}
