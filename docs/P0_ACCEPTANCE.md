# P0 Acceptance

日期：2026-07-01

## 当前结论

P0 主流程已经闭环。P0.0-P0.7 的代码、页面、数据模型和核心单测已落地；P0.8 已生成 UI 截图证据，当前剩余工作是人工走查和演示环境准备。

## 范围状态

- P0.0 项目脚手架：已完成。
- P0.1 管理员认证：已完成。
- P0.2 面试组管理：已完成。
- P0.3 时间段管理：已完成。
- P0.4 候选人提交：已完成。
- P0.5 修改审核：已完成。
- P0.6 预约和自动锁定：已完成。
- P0.7 管理员私有备注：已完成。
- P0.8 UI polish gate：验收中。

## 自动化验收

`pnpm check` 已通过：

- Prettier format check。
- ESLint。
- TypeScript typecheck。
- Vitest：7 个测试文件，13 个测试通过。
- Next.js production build。
- Playwright smoke：`/join` 页面渲染通过。

`scripts/ui-snapshots.sh` 已在本地演示数据库上通过，4 个截图测试通过。

`tests/e2e/business-flow.spec.ts` 已覆盖完整 P0 业务链路：管理员登录、创建面试组、生成时间段、候选人首次提交、候选人修改申请、管理员审核通过、安排面试、取消预约、锁释放、候选人隐私隔离。

## UI 证据

截图目录：`artifacts/ui-snapshots/`

说明：本轮已重跑完整 UI 截图，覆盖后台首页搜索、时间段表头、后台状态中文标签、按钮和状态标签换行修复后的页面。

- `admin-dashboard.png`
- `admin-login.png`
- `appointments.png`
- `candidate-detail.png`
- `candidate-list.png`
- `candidate-modification.png`
- `candidate-submit.png`
- `candidate-submitted.png`
- `group-settings.png`
- `group-slots.png`
- `join.png`
- `review-detail.png`
- `review-list.png`
- `time-overview.png`

## 上线前剩余项

- 人工走查所有 UI 截图，确认移动端、空状态、错误状态、表单反馈和中文文案。
- 在发布前环境重复运行完整业务 E2E，确认部署配置、数据库权限和浏览器环境一致。
- 准备生产环境变量、数据库初始化、管理员创建和部署说明。
