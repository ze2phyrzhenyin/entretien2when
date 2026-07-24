# Release Checklist

本文用于 P0 发布前或交付前复现环境、生成验收证据和执行最终检查。

线上账号创建和人工验收路径见 `docs/DEPLOYMENT.md`。

## 前置条件

- Node.js 和 pnpm 可用。
- PostgreSQL 可连接。
- Playwright Chromium 已安装；如未安装，运行 `pnpm exec playwright install chromium`。
- 仓库依赖已安装：`pnpm install`。

## 环境变量

首次配置：

```bash
cp .env.example .env
```

必须检查并按环境修改：

- `DATABASE_URL`：PostgreSQL 连接串。
- `APP_URL`：候选人链接和截图环境使用的应用地址；生产必须为可信 HTTPS，路径必须与 `NEXT_PUBLIC_BASE_PATH` 一致。
- `NEXT_PUBLIC_BASE_PATH`：子路径部署时的唯一应用路径，例如 `/when2entretien`。
- `ADMIN_BOOTSTRAP_*`：仅空生产库的显式首次初始化使用；部署完成后删除，不可作为常规账号维护方式。
- `SESSION_TTL_DAYS`：管理员 session 有效天数。
- `SESSION_COOKIE_SECURE`：生产必须为 `true`；应用在 production 也会强制该行为。
- `TRUST_PROXY`：仅受信任反向代理覆盖 `X-Real-IP` 时设置为 `true`。
- `CANDIDATE_ACCESS_TOKEN_TTL_MINUTES`：候选人一次性访问链接有效分钟数。
- `CANDIDATE_SESSION_TTL_DAYS`：候选人访问 session 有效天数。
- `CANDIDATE_AUTH_DEV_PREVIEW`：仅本地/E2E 可设为 `true`，生产必须为 `false`。
- `EMAIL_OUTBOX_BATCH_SIZE`：邮件 outbox 每批处理数量。

## 数据库初始化

本地开发或演示环境：

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

生产或发布前环境应使用 Prisma deploy migration：

```bash
pnpm db:generate
pnpm exec prisma migrate deploy
```

只有空生产库需要首次管理员时，显式配置 `ADMIN_BOOTSTRAP_*` 后执行一次 `pnpm db:seed`；既有生产库禁止把 seed 放进部署流水线。

如需手工创建管理员：

```bash
pnpm tsx scripts/create-admin.ts admin@example.com 'StrongPassword_123!' '管理员' SUPER_ADMIN
```

## 演示数据和截图

写入 P0 演示数据：

```bash
pnpm db:seed:demo
```

该命令会输出 `adminEmail`、`adminPassword`、`projectId`、`roundId`、`groupId`、`groupCode`、`candidateId`、`submissionId`。使用输出值重跑截图：

```bash
PLAYWRIGHT_ADMIN_EMAIL='admin@example.com' \
PLAYWRIGHT_ADMIN_PASSWORD='ChangeMe_StrongPassword_123!' \
PLAYWRIGHT_GROUP_ID='<groupId>' \
PLAYWRIGHT_GROUP_CODE='<groupCode>' \
PLAYWRIGHT_CANDIDATE_ID='<candidateId>' \
PLAYWRIGHT_SUBMISSION_ID='<submissionId>' \
bash scripts/ui-snapshots.sh
```

截图会写入 `artifacts/ui-snapshots/`。截图生成后必须人工查看核心页面是否存在文本截断、重叠、错误状态缺失或敏感信息泄露。

## 自动化验收

标准检查：

```bash
pnpm check
```

完整业务 E2E（串行，避免共享测试库并发冷启动造成假阴性）：

```bash
PLAYWRIGHT_WORKERS=1 pnpm exec playwright test --project=chromium
```

完整业务 E2E 会创建 `e2e-admin@example.com` 和 `E2E 全流程 ...` 测试面试组，结束后清理自己的 E2E 面试组和 session。

## 发布前必过项

- `pnpm check` 通过。
- `PLAYWRIGHT_WORKERS=1 pnpm exec playwright test --project=chromium` 通过。
- `bash scripts/ui-snapshots.sh` 通过并完成截图人工走查。
- 生产环境 `.env` 不使用示例管理员密码。
- 数据库 migration 已在目标环境执行。
- `APP_URL` HTTPS 证书有效，HTTP 首跳重定向到 HTTPS，cookie 的 `Secure` 与 basePath 已通过浏览器响应头抽查。
- 若历史环境曾暴露 HTTP：所有管理员密码已轮换，且 `pnpm auth:revoke -- --confirm` 已在目标数据库执行。
- 超级管理员账号已创建并可以登录。
- 候选人端抽查确认不展示其他候选人、锁定原因、内部备注、管理员私有备注。
- `/admin/audit` 可查看本次验收的建组、提交、修改申请、审核、预约、取消预约等审计记录。
- `/admin/projects` 只显示授权组的轮次/统计；项目级面试官池只对授权组的 `OWNER`/`SCHEDULER` 作为共享排期资源可见。
- 安排面试时选择面试官；同一面试官已有重叠 `SCHEDULED` 预约时必须被服务端拒绝。
- `/api/health/ready` 返回 ready，负责人通知 outbox 可通过 `pnpm email:outbox` 处理；没有活跃组 OWNER 时不得向全局/个人邮箱外发候选人信息。

## 启动

开发：

```bash
pnpm dev
```

生产构建和启动：

```bash
pnpm build
pnpm start
```
