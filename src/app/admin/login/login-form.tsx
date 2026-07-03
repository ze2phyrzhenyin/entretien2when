"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { LogIn } from "lucide-react";
import { FormField } from "@/components/design-system/form-field";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminLoginAction, type AdminLoginState } from "@/server/actions/admin-auth";

const initialState: AdminLoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending} isLoading={pending}>
      <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
      {pending ? "正在登录" : "登录后台"}
    </Button>
  );
}

export function AdminLoginForm() {
  const [state, formAction] = useActionState(adminLoginAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormField id="email" label="邮箱">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </FormField>
      <FormField id="password" label="密码">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </FormField>
      {state.error ? <InlineNotice tone="danger">{state.error}</InlineNotice> : null}
      <SubmitButton />
    </form>
  );
}
