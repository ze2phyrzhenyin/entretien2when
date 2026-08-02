"use client";
import { useLocale } from "@/i18n/locale-provider";
import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
async function copyText(value: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    const copied = document.execCommand("copy");
    if (!copied) {
      throw new Error("Copy command failed.");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}
export function CopyButton({ value, label }: { value: string; label?: string }) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <Button
      variant="secondary"
      className="min-w-32"
      onClick={async () => {
        try {
          await copyText(value);
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
      {failed
        ? t("legacy.copy_failed.753d8bb0")
        : copied
          ? t("legacy.copied.8f6f8d97")
          : (label ?? t("legacy.copy.63d90d97"))}
    </Button>
  );
}
