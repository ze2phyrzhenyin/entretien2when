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

- P0 主流程已闭环，当前处于 P0 收尾验收 / UI 打磨阶段。
- P0.0-P0.7 已实现：项目脚手架、管理员认证、面试组管理、时间段管理、候选人提交、修改审核、预约锁定、管理员私有备注。
- P0.8 已生成 UI 截图证据，待人工走查确认视觉和交互细节。

## 验收证据

- `pnpm check` 已通过 format、lint、typecheck、unit tests、production build 和 Playwright smoke。
- 单测覆盖 group code、password hash、permissions、candidate DTO 隐私边界、slot selection、submission review、appointment lock。
- UI 截图位于 `artifacts/ui-snapshots/`。

完整产品、权限、隐私、测试和工程循环见 `docs/`。
