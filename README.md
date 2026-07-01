# interview-scheduler-cn

中文版面试时间管理系统。目标是提供隐私隔离型 when2meet / scheduling 产品：候选人只能提交和查看自己的面试时间，管理员统一审核修改、安排面试并锁定已预约时间。

## 快速开始

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## 常用命令

```bash
pnpm check
pnpm test
pnpm test:e2e
pnpm doctor
```

## 当前阶段

- P0 主流程已闭环并完成验收：管理员登录、建组、候选人提交、修改申请、审核、预约、取消预约、隐私隔离。
- P1.1 已实现管理员操作日志页 `/admin/audit`，覆盖建组、时间段、候选人提交、修改审核、预约、取消预约、管理员备注等审计记录。
- CI 已包含 `pnpm check` 和完整业务 E2E job。

## 验收证据

- `pnpm check` 已通过 format、lint、typecheck、unit tests、production build 和 Playwright smoke。
- 单测覆盖 group code、password hash、permissions、candidate DTO 隐私边界、slot selection、submission review、appointment lock。
- UI 截图位于 `artifacts/ui-snapshots/`。

完整产品、权限、隐私、测试和工程循环见 `docs/`。

发布前交付步骤见 `docs/RELEASE_CHECKLIST.md`。

线上测试账号和人工验收说明见 `docs/DEPLOYMENT.md`。
