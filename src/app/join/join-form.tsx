"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/design-system/form-field";
import { InlineNotice } from "@/components/design-system/inline-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidGroupCode, normalizeGroupCode } from "@/lib/group-code/generate";

export function JoinForm() {
  const router = useRouter();
  const [groupCode, setGroupCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const normalizedCode = normalizeGroupCode(String(formData.get("groupCode") ?? ""));

    if (!isValidGroupCode(normalizedCode)) {
      setError("请输入完整、有效的面试组编号");
      return;
    }

    setError(null);
    const params = new URLSearchParams({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? "")
    });
    router.push(`/candidate/${normalizedCode}?${params.toString()}`);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
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
            setError(null);
          }}
        />
      </FormField>

      {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}

      <Button type="submit" className="w-full">
        进入可用时间选择
      </Button>
    </form>
  );
}
