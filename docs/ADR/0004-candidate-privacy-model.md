# ADR 0004：Candidate Privacy Model

日期：2026-07-01

## 状态

Accepted

## 决策

候选人端只通过 groupCode + email 识别本人记录。候选人 DTO 与管理员 DTO 分离，候选人 DTO 绝不包含其他候选人、锁定原因、内部备注、管理员私有备注、管理员邮箱或可用人数。

## 默认假设

- 当前不做候选人邮箱验证，但 email 仍用于组内唯一识别。
- 候选人修改不立即生效，必须生成 PENDING_REVIEW submission。
- 管理员私有备注使用 `CandidateAdminNote` 存储，visibility 固定 ADMIN_ONLY。

## 后果

- 不能把管理员 detail payload 传给候选人页面再用 CSS 隐藏字段。
- 需要单测断言候选人响应不包含敏感字段。
