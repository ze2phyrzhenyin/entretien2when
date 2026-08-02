"use client";
import { useLocale } from "@/i18n/locale-provider";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { LogIn } from "lucide-react";
import { FormField } from "@/components/design-system/form-field";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { translateKnownSource } from "@/i18n/catalogs";
import { adminLoginAction, type AdminLoginState } from "@/server/actions/admin-auth";
const initialState: AdminLoginState = {};
function SubmitButton() {
  const { t } = useLocale();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending} isLoading={pending}>
      <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
      {pending ? t("legacy.logging_in.9e27d3fb") : t("legacy.log_in_to_the_background.4e0fdd41")}
    </Button>
  );
}
export function AdminLoginForm() {
  const { locale, t } = useLocale();
  const [state, formAction] = useActionState(adminLoginAction, initialState);
  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormField id="email" label={t("legacy.email.73075237")}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </FormField>
      <FormField id="password" label={t("legacy.password.a621ab60")}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </FormField>
      {state.error ? (
        <InlineNotice tone="danger">{translateKnownSource(locale, state.error)}</InlineNotice>
      ) : null}
      <SubmitButton />
    </form>
  );
}
