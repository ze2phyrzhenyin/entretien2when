"use client";

import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/app-url";
import { isCandidateToken } from "@/lib/auth/candidate-token-format";
import { Button } from "@/components/ui/button";

export function CandidateAuthConfirmation() {
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fragmentToken = decodeURIComponent(window.location.hash.slice(1));
    setToken(isCandidateToken(fragmentToken) ? fragmentToken : "");
    setReady(true);
    // Remove the bearer token from the visible address bar and browser
    // history before the candidate continues.
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, []);

  if (!ready) {
    return <p className="mt-5 text-sm text-muted-foreground">正在检查访问链接…</p>;
  }

  if (!token) {
    return (
      <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        访问链接无效或缺少一次性凭证，请从招聘方最新发送的邮件中重新打开。
      </p>
    );
  }

  return (
    <form action={withBasePath("/candidate/auth/consume")} method="post" className="mt-5">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" className="w-full">
        继续进入
      </Button>
    </form>
  );
}
