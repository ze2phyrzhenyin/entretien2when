# interview-scheduler-cn

中英文面试时间管理系统。目标是提供隐私隔离型 when2meet / scheduling 产品：候选人只能提交和查看自己的面试时间，管理员统一审核修改、安排面试并锁定已预约时间。匿名首次访问默认 English，界面右上角可一键切换中文 / English；语言选择会在刷新、登录和候选人邮件流程中保持一致，历史未标语言内容仍按中文兼容。

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
pnpm i18n:check
pnpm test
WHEN2ENTRETIEN_ALLOW_E2E_MUTATION=1 \
DATABASE_URL='postgresql://.../when2entretien_e2e?schema=public' \
pnpm test:e2e
pnpm run app:doctor
```

## 当前阶段

- P0 主流程已在隔离数据库完成代码级验收：管理员登录、建组、候选人邮箱访问链接、提交、修改申请、审核、预约、取消预约、隐私隔离。
- 管理员与组成员 UI 已支持创建、启停、角色调整、撤权、密码重置、最后一个 `SUPER_ADMIN`/`OWNER` 保护和完整审计。
- 项目页已支持项目复用、轮次编辑、面试官池、按组/轮次/面试官/状态筛选的项目排期视图。
- 候选人和面试官邮件通过可靠队列发送；批量候选人通知按每位收件人的语言偏好选择经审核的中英文内容；预约、改约、取消均生成 ICS 与 Google/Outlook 快捷链接，并支持自动提醒。
- 候选人认证链接使用 URL fragment + POST 消费；每个面试组使用独立 Cookie，同一浏览器可并行参加多场招聘流程。
- 移动后台采用卡片/标签式详情和安全区底部留白，长列表均使用服务端分页或受限时间窗。
- 安全与运维已覆盖 HTTPS/basePath、权限隔离、并发排期约束、邮件恢复、数据保留、候选人导出/匿名化、部署回滚和备份校验；线上 TLS、凭据轮换和目标库迁移仍须由有权限的运维人员执行。
- CI 包含依赖审计、完整检查、关键串行 E2E 和真实 production basePath 浏览器验证。
- 中英文界面使用显式、类型化消息键；服务端首屏直接输出目标语言，不扫描或改写 DOM，也不会把候选人姓名、备注、组名称等用户/数据库内容送入翻译器。

## 验收证据

- `pnpm check` 已通过 format、lint、typecheck、unit tests 与 production build；完整 E2E 必须在显式指定的隔离数据库中串行运行。
- 单测覆盖权限、隐私边界、一次性认证、加密 outbox、ICS、slot selection、submission review 和 appointment lock。
- UI 截图位于 `artifacts/ui-snapshots/`。

完整产品、权限、隐私、测试和工程循环见 `docs/`。

发布前交付步骤见 `docs/RELEASE_CHECKLIST.md`。

线上测试账号和人工验收说明见 `docs/DEPLOYMENT.md`。
