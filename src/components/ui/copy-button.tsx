"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label = "复制" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <Button
      variant="secondary"
      className="min-w-32"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setFailed(false);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          setFailed(true);
          window.setTimeout(() => setFailed(false), 1800);
        }
      }}
    >
      <Copy className="h-4 w-4" aria-hidden="true" />
      {failed ? "复制失败" : copied ? "已复制" : label}
    </Button>
  );
}
