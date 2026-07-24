"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { FormField } from "@/components/design-system/form-field";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidGroupCode, normalizeGroupCode } from "@/lib/group-code/generate";
import {
  requestCandidateAccessAction,
  type CandidateAccessRequestState
} from "@/server/actions/candidate";

const initialState: CandidateAccessRequestState = {};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending || disabled} isLoading={pending}>
      {pending ? "正在发送访问链接" : "发送访问链接"}
    </Button>
  );
}

export function JoinForm() {
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
          setClientError("请输入完整、有效的面试组编号");
          event.preventDefault();
          return;
        }
        setClientError(null);
      }}
      className="space-y-5"
      noValidate
    >
      <div>
        <FormField id="name" label="姓名" description="请填写与面试沟通一致的姓名。">
          <Input id="name" name="name" autoComplete="name" placeholder="请输入姓名" required />
        </FormField>
      </div>

      <FormField id="email" label="邮箱">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          required
        />
      </FormField>

      <FormField id="groupCode" label="面试组编号">
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
        <InlineNotice tone="danger">{state.message}</InlineNotice>
      ) : null}
      {state.status === "success" && state.message ? (
        <InlineNotice tone="success">
          <span>{state.message}</span>
          {state.previewHref ? (
            <a className="ml-2 font-medium text-primary" href={state.previewHref}>
              打开测试访问链接
            </a>
          ) : null}
        </InlineNotice>
      ) : null}

      <SubmitButton disabled={Boolean(clientError)} />
    </form>
  );
}
