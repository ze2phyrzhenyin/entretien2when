# Architecture

## 技术栈

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui 风格本地组件
- PostgreSQL + Prisma
- Zod 输入校验
- Vitest 单测
- Playwright E2E 和 UI 截图
- pnpm 包管理

## 模块边界

- `src/app`：页面、route handlers、server actions 接入点。
- `src/components`：纯 UI 和布局组件，不直接读取敏感数据。
- `src/lib/auth`：密码 hash、session、requireAdmin。
- `src/lib/permissions`：管理员组权限判断。
- `src/lib/candidate`：候选人 DTO 和候选人端隐私边界。
- `src/lib/db`：Prisma client。
- `src/server/actions`：服务端业务入口，必须使用 Zod 校验输入。
- `prisma/schema.prisma`：数据模型和约束。

## 数据流

候选人端：

1. `/join` 收集姓名、邮箱、组编号。
2. 服务端按 groupCode + normalizedEmail 识别候选人。
3. 首次提交直接生成 ACTIVE submission。
4. 后续修改生成 PENDING_REVIEW submission，不覆盖 activeSubmission。
5. 候选人 DTO 不返回其他候选人、锁定原因、管理员私有备注、内部备注。

管理员端：

1. 邮箱密码登录，创建 httpOnly session。
2. 所有后台入口 `requireAdmin`。
3. `requireAdmin` 验证有效管理员 session；全局高权限动作再调用 `requireSuperAdmin`。
4. 普通管理员的读查询在数据库边界应用 `accessibleGroupWhere` / `accessibleProjectWhere`，写操作调用带明确角色矩阵的 `requireGroupPermission`。
5. `OWNER` 管设置和成员，`SCHEDULER` 管排期与邮件，`REVIEWER` 管审核和候选人跟进，`VIEWER` 只读。

邮件和日历：

1. 页面请求只创建带幂等键的 `EmailOutbox` / `CandidateEmailDelivery`，不等待供应商。
2. worker 通过 lease 领取、有限重试并跳过已经取消或改约的陈旧提醒。
3. 候选人访问链接在同一事务创建 token 和加密 outbox；明文 token 不落日志或 URL query。
4. 预约通知包含 RFC 5545 ICS；候选人和每位面试官分别发送，避免公开收件人列表。

## 关键风险

- 候选人响应中泄露 `CandidateAdminNote`、`internalNote`、`reasonInternal`。
- 普通管理员跨组或越角色读取/写入。
- 预约锁并发导致 double-booking。
- 修改审核通过时未重新校验 slot 状态。
- 前端隐藏按钮但服务端未二次校验。

## 当前实现范围

P0-P2 已实现：认证与权限、面试组、项目/轮次/面试官、候选人提交和审核、并发安全排期、可靠邮件/日历提醒、审计、数据生命周期和响应式后台。是否已在某个生产环境发布仍以发布清单和该环境的证据为准。
