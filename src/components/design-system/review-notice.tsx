import { InlineNotice } from "@/components/design-system/inline-notice";

export function ReviewNotice({ mode = "default" }: { mode?: "default" | "modify" | "pending" }) {
  const messageByMode = {
    default:
      "提交后如需修改，新的修改内容需要管理员审核。审核通过前，系统仍以当前已生效的信息为准。",
    modify:
      "本次修改不会立即生效。提交后将发送给管理员审核，审核通过后才会替换你当前已提交的信息。",
    pending: "你的修改申请正在等待管理员审核。审核通过前，当前有效提交不会改变。"
  };

  return (
    <InlineNotice tone={mode === "pending" ? "warning" : "info"} title="修改审核提醒">
      {messageByMode[mode]}
    </InlineNotice>
  );
}
