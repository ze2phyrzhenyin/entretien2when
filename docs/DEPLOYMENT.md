# Deployment And Acceptance Guide

本文用于线上测试环境和发布前验收。不要把真实管理员密码、数据库密码、部署平台 token 或临时验收账号密码写入 git；只提交账号创建方式和走查流程。

## 线上测试账号

推荐为每个线上测试环境创建一个独立管理员账号，例如：

- 邮箱：`qa-admin@example.com`
- 昵称：`线上验收管理员`
- 角色：`SUPER_ADMIN`
- 密码：由密码管理器或部署平台 secret 保存，不写入仓库、PR、issue、截图或聊天记录。

创建方式二选一：

```bash
pnpm tsx scripts/create-admin.ts qa-admin@example.com '<PASSWORD_FROM_SECRET>' '线上验收管理员' SUPER_ADMIN
```

或在首次部署时通过环境变量初始化：

```bash
ADMIN_BOOTSTRAP_EMAIL='qa-admin@example.com'
ADMIN_BOOTSTRAP_PASSWORD='<PASSWORD_FROM_SECRET>'
ADMIN_BOOTSTRAP_NAME='线上验收管理员'
pnpm db:seed
```

生产环境和公开演示环境不得使用 `.env.example` 里的示例密码。测试结束后，如账号不再使用，应禁用账号或轮换密码。

## 发布前环境检查

- `DATABASE_URL` 指向目标 PostgreSQL。
- `APP_URL` 指向实际访问域名。
- `ADMIN_BOOTSTRAP_PASSWORD` 不是示例值。
- `SESSION_TTL_DAYS` 符合目标环境要求。
- 如启用候选人邮件发送，`MAILATO_COMMAND` 指向服务器上的 `mailato` wrapper，线上建议为 `/usr/local/bin/mailato`。
- `MAILATO_DRY_RUN` 仅在本地或演练环境设为 `true`；真实发送环境设为 `false`。
- 数据库已执行 `pnpm exec prisma migrate deploy`。
- `pnpm check` 通过。
- 完整业务 E2E 通过：

```bash
pnpm exec playwright test tests/e2e/business-flow.spec.ts --project=chromium
```

## Aliyun 远端部署

当前远端入口：

- Portal: `http://120.24.108.234/`
- Interview Scheduler CN: `http://120.24.108.234/when2entretien`
- 健康检查：`http://120.24.108.234/when2entretien/api/health`

部署命令：

```bash
scripts/deploy-aliyun.sh
```

部署脚本会：

- 上传当前项目到 `/opt/when2entretien/releases/<release>`。
- 使用远端 PostgreSQL `127.0.0.1:15432`。
- 首次部署时创建远端数据库、数据库用户和超级管理员密码。
- 将真实环境变量写入 `/etc/when2entretien/when2entretien.env`。
- 通过 systemd 启动 `when2entretien-web.service`。
- 在 nginx 根站点下挂载 `/when2entretien`。
- 复用远端 `/usr/local/bin/mailato` 和 `/etc/mailato/mailato.env`，不复制邮箱密钥到本仓库。

远端真实密码只保存在服务器 env 文件中，不提交到 git。需要查看或轮换线上管理员密码时，登录服务器处理：

```bash
sudo sed -n 's/^ADMIN_BOOTSTRAP_EMAIL=/ADMIN_BOOTSTRAP_EMAIL=/p' /etc/when2entretien/when2entretien.env
sudo systemctl status when2entretien-web.service --no-pager
```

## 人工验收走查

管理员端：

- `/admin/login`：使用线上测试管理员登录，确认错误密码不能登录。
- `/admin`：查看面试组列表，确认普通管理员不会看到未授权组。
- `/admin/groups/new`：创建一个验收面试组，记录组编号。
- `/admin/groups/[id]/settings`：确认组名称、公开说明、候选人最多选择数量可保存。
- `/admin/groups/[id]/slots`：生成并查看时间段。
- `/admin/groups/[id]/candidates`：查看候选人列表。
- `/admin/groups/[id]/candidates`：勾选候选人，发送批量邮件；确认收件人逐个单独发送。
- `/admin/groups/[id]/candidates/[candidateId]`：安排面试、保存管理员私有备注。
- `/admin/groups/[id]/candidates/[candidateId]`：给单个候选人发送邮件。
- `/admin/groups/[id]/reviews`：处理候选人的修改申请。
- `/admin/groups/[id]/appointments`：查看预约并取消预约，确认时间锁释放。
- `/admin/groups/[id]/overview`：查看时间段汇总。
- `/admin/audit`：查看候选人提交、修改申请、审核、预约、取消预约、管理员备注等操作日志。

候选人端：

- `/join`：输入姓名、邮箱、面试组编号进入候选人页面。
- `/candidate/[groupCode]`：提交可用时间。
- 提交后申请修改，确认修改申请进入待审核状态。
- 管理员通过修改后，候选人看到更新后的有效可用时间。
- 管理员安排面试后，候选人能看到面试时间、地点或链接、候选人可见说明。

隐私隔离：

- 候选人 A 页面不得出现候选人 B 的姓名、邮箱或备注。
- 候选人页面不得出现管理员内部备注。
- 候选人页面不得出现管理员私有备注。
- 候选人页面不得展示已锁定时间属于谁或锁定原因。
- 候选人页面不得出现邮件发送 UI、mailato 配置、SMTP/Resend 信息。
- 普通管理员不得访问未授权面试组。

## 验收记录

每次线上验收建议记录：

- 环境域名。
- git commit SHA。
- migration 执行时间。
- `pnpm check` 结果。
- 完整业务 E2E 结果。
- UI 截图人工走查结论。
- 线上测试管理员账号邮箱，不记录密码。
