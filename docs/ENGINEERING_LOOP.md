# Engineering Loop

每次开发都遵循以下循环：

1. Read：阅读 PRD、相关 ADR、相关代码。
2. Restate：用 5-10 行复述当前任务和风险。
3. Plan：写出小步计划和将修改的文件。
4. Implement：分层实现，避免一次性大改。
5. Self-review：检查权限、隐私、错误状态、边界条件。
6. Test：运行 lint、typecheck、unit、e2e、build。
7. UI QA：涉及 UI 必须跑 Playwright 截图或至少生成页面检查清单。
8. Security QA：涉及认证、权限、候选人数据、备注、预约锁定时必须检查越权。
9. Commit：通过后使用 Conventional Commits 提交。
10. Report：总结完成内容、测试结果、后续风险。

任何功能未通过 `scripts/check.sh`，不允许标记完成。

## 本次任务复述

- P0.0-P0.7 已完成，当前循环用于 P0 收尾验收和 UI 打磨。
- 风险重点：候选人隐私、管理员私有备注不泄露、非超级管理员不能进入后台、预约锁唯一性、密码不可明文保存、修改审核不提前覆盖旧版本。
- 收尾时先以 `pnpm check` 和 UI 截图为硬门槛，再补充人工业务流程验收。
