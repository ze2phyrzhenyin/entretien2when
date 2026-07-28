# Test Plan

## Unit Tests

- group code generator 生成复杂码、无混淆字符、格式正确。
- candidate submit validation。
- modification review state transition。
- appointment lock 创建和释放。
- permission helper。
- candidate DTO 不包含敏感字段。
- admin private note 不进入 candidate response。
- candidate session Cookie 按 group 隔离。
- 访问链接 outbox 加密和 ICS 转义/取消语义。
- 管理员角色能力矩阵和项目查询作用域。

## Integration Tests

- 候选人首次提交。
- 候选人修改生成 pending review，不覆盖 active submission。
- 管理员通过修改后 active 版本替换。
- 管理员拒绝修改后 active 版本不变。
- 安排面试后 slot locked。
- locked slot 不出现在候选人可选列表中。
- 普通管理员只能进入授权组且写操作再次校验角色。
- 候选人不能获取其他候选人数据。
- 最后一个有效 `SUPER_ADMIN` / `OWNER` 不能被降级、停用或撤权。
- 邮件 worker 的 lease、重试、幂等和陈旧提醒跳过。

## E2E Tests

- `tests/e2e/smoke.spec.ts`：`/join` smoke。
- `tests/e2e/ui-snapshots.spec.ts`：P0 核心页面截图。
- `tests/e2e/business-flow.spec.ts`：管理员登录、创建面试组、生成时间段、候选人提交时间、候选人申请修改、管理员审核通过、管理员安排面试、取消预约释放锁、第二个候选人看不到已锁定时间原因、管理员私有备注和内部备注不出现在候选人端，并校验 `/admin/audit` 出现关键业务审计记录。
- `tests/e2e/candidate-auth-security.spec.ts`：fragment + POST 一次性消费、并发只成功一次、关闭组不烧毁 token、多组 Cookie 并存。
- `tests/e2e/scheduling-integrity.spec.ts`：slot、候选人和面试官排期数据库约束及审核竞态。
- `tests/e2e/admin-role-management.spec.ts`：最后 OWNER 保护、替代 OWNER、普通管理员跨组拒绝。
- `tests/e2e/project-upgrade.spec.ts`：项目复用、轮次编辑/新增、项目排期和面试官筛选。
- `tests/e2e/email-ops.spec.ts`：持久化队列、worker 投递、失败重试和历史展示。
- `tests/e2e/base-path-production.spec.ts`：真实 production build 的子路径页面、静态资源和导航。

## UI Screenshot Checks

- `/join`
- candidate submit page
- candidate submitted page
- admin login
- admin dashboard
- group settings
- candidate list
- candidate detail
- review detail
- time overview

## 当前自动化覆盖

- `pnpm check` 覆盖 format、lint、typecheck、unit tests 和 production build；已安装 Chromium且显式使用隔离数据库时才附加 smoke。
- 完整 E2E 必须显式 opt-in 且数据库名称包含 `e2e`、`test` 或 `audit`，否则 runner 拒绝修改。
- `scripts/ui-snapshots.sh` 已在本地演示数据库上通过，`artifacts/ui-snapshots/` 已保存 P0 核心页面截图。
- `pnpm exec playwright test tests/e2e/business-flow.spec.ts --project=chromium` 已覆盖 P0 业务全链路和 P1 操作日志页关键记录。
