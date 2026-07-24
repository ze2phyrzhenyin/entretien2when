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

- P0 主流程已在隔离数据库完成代码级验收：管理员登录、建组、候选人邮箱访问链接、提交、修改申请、审核、预约、取消预约、隐私隔离。
- P1.1 已实现管理员操作日志页 `/admin/audit`，覆盖建组、时间段、候选人提交、修改审核、预约、取消预约、管理员备注等审计记录。
- P1.2 已落地组级管理员成员权限、负责人通知 outbox、候选人访问 session、ready health check 和固定面试时长预约。
- P2 已落地招聘项目/默认轮次/面试官池底座，后台新增 `/admin/projects`，预约/改约支持面试官选择和重叠冲突检测。
- 安全加固已覆盖 HTTPS/basePath Cookie、跨组权限、一次性链接原子消费、排期数据库约束、DST、邮件恢复与共享限流；线上 TLS 配置、凭据轮换和目标库迁移仍须按发布清单由有权限的运维人员执行。
- CI 已包含 `pnpm check` 和关键串行 E2E job。

## 验收证据

- `pnpm check` 已通过 format、lint、typecheck、unit tests 与 production build；完整 E2E 必须在显式指定的隔离数据库中串行运行。
- 单测覆盖 group code、password hash、group/project permissions、candidate DTO 隐私边界、slot selection、submission review、appointment lock。
- UI 截图位于 `artifacts/ui-snapshots/`。

完整产品、权限、隐私、测试和工程循环见 `docs/`。

发布前交付步骤见 `docs/RELEASE_CHECKLIST.md`。

线上测试账号和人工验收说明见 `docs/DEPLOYMENT.md`。
