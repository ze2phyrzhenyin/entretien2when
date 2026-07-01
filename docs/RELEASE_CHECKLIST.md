# Release Checklist

本文用于 P0 发布前或交付前复现环境、生成验收证据和执行最终检查。

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
- `APP_URL`：候选人链接和截图环境使用的应用地址。
- `ADMIN_BOOTSTRAP_EMAIL`：初始超级管理员邮箱。
- `ADMIN_BOOTSTRAP_PASSWORD`：初始超级管理员密码，生产环境不得使用示例密码。
- `ADMIN_BOOTSTRAP_NAME`：初始超级管理员名称。
- `SESSION_TTL_DAYS`：管理员 session 有效天数。

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
pnpm db:seed
```

如需手工创建管理员：

```bash
pnpm tsx scripts/create-admin.ts admin@example.com 'StrongPassword_123!' '管理员' SUPER_ADMIN
```

## 演示数据和截图

写入 P0 演示数据：

```bash
pnpm db:seed:demo
```

该命令会输出 `adminEmail`、`adminPassword`、`groupId`、`groupCode`、`candidateId`、`submissionId`。使用输出值重跑截图：

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

完整业务 E2E：

```bash
pnpm exec playwright test tests/e2e/business-flow.spec.ts --project=chromium
```

完整业务 E2E 会创建 `e2e-admin@example.com` 和 `E2E 全流程 ...` 测试面试组，结束后清理自己的 E2E 面试组和 session。

## 发布前必过项

- `pnpm check` 通过。
- `pnpm exec playwright test tests/e2e/business-flow.spec.ts --project=chromium` 通过。
- `bash scripts/ui-snapshots.sh` 通过并完成截图人工走查。
- 生产环境 `.env` 不使用示例管理员密码。
- 数据库 migration 已在目标环境执行。
- 超级管理员账号已创建并可以登录。
- 候选人端抽查确认不展示其他候选人、锁定原因、内部备注、管理员私有备注。

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
