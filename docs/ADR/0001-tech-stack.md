# ADR 0001：Tech Stack

日期：2026-07-01

## 状态

Accepted

## 决策

使用 Next.js App Router + TypeScript + Tailwind CSS + shadcn/ui 风格本地组件 + PostgreSQL + Prisma + Zod + Playwright + Vitest。包管理器使用 pnpm。

## 默认假设

- P0 先使用自有邮箱密码管理员登录，不接 OAuth。
- PostgreSQL 是目标数据库；本地如果尚未启动数据库，仍保持 schema、client generate、build 可运行。
- UI 组件先本地实现轻量 Button/Input/Card/Label，后续如引入 shadcn CLI 必须保持设计系统 token。

## 后果

- App Router 统一 server component、server action 和 route handler。
- Prisma schema 成为权限和隐私模型的事实数据契约。
- Playwright 负责 E2E 和 UI 截图，不用手动截图替代质量门禁。
