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
- `APP_URL` 是实际的 **HTTPS** 地址；如果部署在子路径，其路径必须与 `NEXT_PUBLIC_BASE_PATH` 相同。
- HTTP 同一路径首跳必须为 301/308 到该 HTTPS 地址，且证书必须由客户端信任。
- `SESSION_COOKIE_SECURE=true`；生产环境不会接受 `false` 作为降级选项。
- 若反向代理终止 TLS，只有在其覆盖 `X-Real-IP` 时才设置 `TRUST_PROXY=true`。
- `ADMIN_BOOTSTRAP_PASSWORD` 仅用于空生产库的显式首次初始化，不是示例值，也不保留在长期运行环境中。
- `SESSION_TTL_DAYS` 符合目标环境要求。
- 如启用候选人邮件发送，`MAILATO_COMMAND` 指向服务器上的 `mailato` wrapper，线上建议为 `/usr/local/bin/mailato`。
- `MAILATO_DRY_RUN` 仅在本地或演练环境设为 `true`；真实发送环境设为 `false`。
- 邮件小流量验收、发送历史和重试说明见 `docs/EMAIL_OPERATIONS.md`。
- 数据库已执行 `pnpm exec prisma migrate deploy`。
- PostgreSQL 已安装与服务端主版本匹配的 `postgresql-contrib` 包；本项目的
  排期排他约束依赖 `btree_gist` 扩展。
- `pnpm check` 通过。
- 完整业务 E2E 通过：

```bash
pnpm exec playwright test tests/e2e/business-flow.spec.ts --project=chromium
```

## Aliyun 远端部署

旧的裸 IP HTTP 入口不是可发布入口，不能再用于登录或候选人访问。先为正式域名配置可信 TLS 证书和 HTTP→HTTPS 跳转，再部署应用。

### 受管目标：`zhaoali`

本项目的生产目标已登记为服务器管理项目中的 `zhaoali`，不要把 SSH IP、私钥路径或登录命令散落在个人脚本里：

- 管理目录：`/Users/zephyrsui/Developer/server-ops`
- 服务器 ID：`zhaoali`
- 应用 ID：`when2entretien`
- 预留独立域名：`when2entretien.120.24.108.234.nip.io`
- 唯一公开入口：`https://when2entretien.120.24.108.234.nip.io/when2entretien`

域名必须先完成 DNS、可信证书和 HTTP→HTTPS 跳转，才可执行受控发布：

```bash
cd /Users/zephyrsui/Developer/server-ops
./serverctl deploy --yes zhaoali when2entretien
```

该登记只保存非敏感的目标/路径/服务名；数据库 URL、邮件凭据、管理员密码和 SSH 私钥仍只留在服务器或密码管理器中。

发布前必须在独立终端验证：

```bash
curl -I http://interviews.example.com/when2entretien/
curl -fsS https://interviews.example.com/when2entretien/api/health/ready
```

第一条必须返回到相同路径的 HTTPS `Location`；第二条必须在不使用 `-k` 的情况下成功。

部署命令：

```bash
PUBLIC_ORIGIN=https://interviews.example.com/when2entretien \
scripts/deploy-aliyun.sh
```

仅首次向空生产数据库创建管理员时，额外传入 `--bootstrap-admin`。常规部署绝不运行 seed。

部署会在每次 migration 前创建 root-only PostgreSQL 备份到
`/opt/when2entretien/backups/`，默认保留最近 7 份。对于本次排期完整性
migration：已结束的重叠 OPEN slot 会仅被关闭（保留原 ID、候选人提交和预约
引用）；任何当前或未来的重叠 OPEN slot 都会中止发布，必须先经人工排期修复。

部署脚本会：

- 上传当前项目到 `/opt/when2entretien/releases/<release>`。
- 使用远端 PostgreSQL `127.0.0.1:15432`。
- 首次部署时创建远端数据库和数据库用户；只有显式 `--bootstrap-admin` 才创建一次超级管理员，且既有账号不会被重置、启用或提升权限。
- 将真实环境变量写入 `/etc/when2entretien/when2entretien.env`。
- 通过 systemd 启动 `when2entretien-web.service`。
- 通过 systemd timer 启动 `when2entretien-web-email-outbox.timer`，定期处理负责人通知 outbox。
- 在 nginx 根站点下挂载 `/when2entretien`。
- 复用远端 `/usr/local/bin/mailato` 和 `/etc/mailato/mailato.env`，不复制邮箱密钥到本仓库。

远端真实密码只保存在密码管理器/部署 secret 中，不提交到 git，bootstrap 完成后也不保留在运行时 env 文件中。需要轮换线上管理员密码时，在受控终端执行：

```bash
ADMIN_ROTATE_PASSWORD='<new-long-random-password>' \
pnpm admin:reset-password -- admin@example.com --confirm
```

若此应用曾通过 HTTP 暴露，先启用 HTTPS，再为每个管理员轮换密码，最后在目标数据库执行一次：

```bash
pnpm auth:revoke -- --confirm
```

该命令会撤销所有管理员 session、候选人 session 和尚未使用的候选人访问链接；它不自动替用户分发新密码。

## 人工验收走查

管理员端：

- `/admin/login`：使用线上测试管理员登录，确认错误密码不能登录。
- `/admin`：查看面试组列表，确认超级管理员可以看到全部面试组。
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
- 普通管理员只能进入自己的授权面试组；必须验证其无法通过全局预约、审核、项目或候选人详情读取其他组数据。

## 验收记录

每次线上验收建议记录：

- 环境域名。
- git commit SHA。
- migration 执行时间。
- `pnpm check` 结果。
- 完整业务 E2E 结果。
- UI 截图人工走查结论。
- 线上测试管理员账号邮箱，不记录密码。
