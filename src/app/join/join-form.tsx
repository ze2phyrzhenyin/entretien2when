"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      setError("请输入完整且有效的面试组编号");
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
        <Label htmlFor="name">姓名</Label>
        <Input id="name" name="name" autoComplete="name" placeholder="请输入姓名" required />
        <p className="mt-1 text-xs text-muted-foreground">请填写与面试沟通一致的姓名。</p>
      </div>

      <div>
        <Label htmlFor="email">邮箱</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          required
        />
      </div>

      <div>
        <Label htmlFor="groupCode">面试组编号</Label>
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
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <Button type="submit" className="w-full">
        进入时间选择
      </Button>
    </form>
  );
}
