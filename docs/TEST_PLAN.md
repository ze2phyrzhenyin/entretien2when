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
- 普通管理员不能访问未授权组。
- 候选人不能获取其他候选人数据。

## E2E Tests

- 管理员登录。
- 创建面试组。
- 候选人提交时间。
- 候选人申请修改。
- 管理员审核通过。
- 管理员安排面试。
- 第二个候选人看不到已锁定时间原因。
- 管理员写私有备注，候选人端看不到。

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

当前 P0.1 已覆盖 group code、password hash、permission helper、candidate DTO 隐私字段。
