"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { FormField } from "@/components/design-system/form-field";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createGroupAction, type GroupFormState } from "@/server/actions/group";

type TimezoneOption = {
  value: string;
  label: string;
};

const initialState: GroupFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full md:w-auto" disabled={pending} isLoading={pending}>
      {pending ? null : <Plus className="h-4 w-4" aria-hidden="true" />}
      {pending ? "正在创建" : "创建面试组"}
    </Button>
  );
}

export function NewGroupForm({ timezoneOptions }: { timezoneOptions: TimezoneOption[] }) {
  const [state, formAction] = useActionState(createGroupAction, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <FormField id="name" label="面试组名称" error={errors.name}>
        <Input
          id="name"
          name="name"
          required
          placeholder="例如：产品经理一面 7 月批次"
          aria-invalid={Boolean(errors.name)}
        />
      </FormField>
      <FormField id="publicDescription" label="候选人可见说明" error={errors.publicDescription}>
        <Textarea
          id="publicDescription"
          name="publicDescription"
          placeholder="候选人可见，例如面试形式、预计时长、注意事项。"
          aria-invalid={Boolean(errors.publicDescription)}
        />
      </FormField>
      <div className="grid gap-5 md:grid-cols-2">
        <FormField id="timezone" label="时区" error={errors.timezone}>
          <Select
            id="timezone"
            name="timezone"
            defaultValue="Asia/Shanghai"
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
            defaultValue="OPEN"
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
          description="候选人可选择的最小时间单位。"
          error={errors.slotDurationMinutes}
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
          label="面试时长（分钟）"
          description="正式面试预计占用时长，必须短于时间粒度。"
          error={errors.interviewDurationMinutes}
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
        <FormField id="minSelectSlots" label="最少选择数量" error={errors.minSelectSlots}>
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
        <FormField id="maxSelectSlots" label="最多选择数量" error={errors.maxSelectSlots}>
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
        {state.message ??
          "系统会自动生成高强度面试组编号。创建成功后，请在设置页复制编号或候选人链接。"}
      </InlineNotice>
      <SubmitButton />
    </form>
  );
}
