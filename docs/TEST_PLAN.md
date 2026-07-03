# Test Plan

## Unit Tests

- group code generator 生成复杂码、无混淆字符、格式正确。
- candidate submit validation。
- modification review state transition。
- appointment lock 创建和释放。
- permission helper。
- candidate DTO 不包含敏感字段。
- admin private note 不进入 candidate response。

## Integration Tests

- 候选人首次提交。
- 候选人修改生成 pending review，不覆盖 active submission。
- 管理员通过修改后 active 版本替换。
- 管理员拒绝修改后 active 版本不变。
- 安排面试后 slot locked。
- locked slot 不出现在候选人可选列表中。
- 非超级管理员账号不能进入后台。
- 候选人不能获取其他候选人数据。

## E2E Tests

- `tests/e2e/smoke.spec.ts`：`/join` smoke。
- `tests/e2e/ui-snapshots.spec.ts`：P0 核心页面截图。
- `tests/e2e/business-flow.spec.ts`：管理员登录、创建面试组、生成时间段、候选人提交时间、候选人申请修改、管理员审核通过、管理员安排面试、取消预约释放锁、第二个候选人看不到已锁定时间原因、管理员私有备注和内部备注不出现在候选人端，并校验 `/admin/audit` 出现关键业务审计记录。

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

- `pnpm check` 覆盖 format、lint、typecheck、unit tests、production build 和 Playwright smoke。
- 单测已覆盖 group code、password hash、permission helper、candidate DTO 隐私字段、slot selection、submission review、appointment lock。
- `scripts/ui-snapshots.sh` 已在本地演示数据库上通过，`artifacts/ui-snapshots/` 已保存 P0 核心页面截图。
- `pnpm exec playwright test tests/e2e/business-flow.spec.ts --project=chromium` 已覆盖 P0 业务全链路和 P1 操作日志页关键记录。
