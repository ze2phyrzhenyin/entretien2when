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
3. 超级管理员访问全部组，普通管理员通过 GroupAdmin 授权访问。
4. 组级操作必须 `requireGroupPermission`。

## 关键风险

- 候选人响应中泄露 `CandidateAdminNote`、`internalNote`、`reasonInternal`。
- 普通管理员越权访问未授权组。
- 预约锁并发导致 double-booking。
- 修改审核通过时未重新校验 slot 状态。
- 前端隐藏按钮但服务端未二次校验。

## 当前实现范围

P0.0-P0.7 已落地：基础项目、Prisma schema、管理员登录、session、密码 hash、seed/create-admin、面试组管理、时间段管理、候选人提交、修改审核、预约锁定、管理员私有备注、核心页面和单测。

P0.8 已生成 UI 截图证据，当前重点是人工走查截图、修正明显文案/交互问题，并为演示环境准备稳定数据。
