import { InlineNotice } from "@/components/design-system/inline-notice";

export function PrivacyNotice({
  children = "你的信息不会展示给其他候选人。"
}: {
  children?: React.ReactNode;
}) {
  return (
    <InlineNotice tone="privacy" title="隐私提示">
      {children}
    </InlineNotice>
  );
}
