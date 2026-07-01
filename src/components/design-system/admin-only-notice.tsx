import { InlineNotice } from "@/components/design-system/inline-notice";

export function AdminOnlyNotice({
  children = "仅管理员可见，候选人不会看到这部分内容。"
}: {
  children?: React.ReactNode;
}) {
  return (
    <InlineNotice tone="admin" title="仅管理员可见">
      {children}
    </InlineNotice>
  );
}
