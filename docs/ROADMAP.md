# Roadmap

当前状态：P0/P1/P2 所列功能已在隔离环境通过代码与自动化验收；尚未因此宣称线上发布完成。线上可信 TLS、HTTP→HTTPS 跳转、目标数据库迁移以及历史 HTTP 暴露后的密码/会话/token 轮换，必须由具备生产权限的人员按 `docs/RELEASE_CHECKLIST.md` 执行。

## P0.0 项目脚手架

状态：已完成。

- Next.js + TypeScript + Tailwind + 基础组件。
- Prisma + PostgreSQL 配置。
- env example。
- CI。
- 基础布局。

## P0.1 管理员认证

状态：已完成。

- admin login。
- session。
- password hash。
- requireAdmin。
- seed super admin。
- create-admin script。

## P0.2 面试组管理

状态：已完成。

- create group。
- random group code。
- group list。
- group settings。
- copy group code/link。
- group admin authorization 初版。

## P0.3 时间段管理

状态：已完成。

- slot duration。
- batch slot generation。
- open/closed slots。
- admin slots view。

## P0.4 候选人提交

状态：已完成。

- `/join`。
- candidate submit page。
- note。
- initial submission。
- candidate self view。
- candidate privacy DTO。

## P0.5 修改审核

状态：已完成。

- request modification。
- warning copy。
- pending review。
- admin review list/detail。
- approve/reject。
- version replacement。

## P0.6 预约和自动锁定

状态：已完成。

- schedule appointment。
- create locks。
- candidate unavailable display。
- cancel appointment releases locks。
- no double booking。

## P0.7 管理员私有备注

状态：已完成。

- CandidateAdminNote model。
- admin candidate detail note editor。
- tests proving candidate cannot see it。

## P0.8 UI polish gate

状态：已完成。

- Run ui-quality-gate skill。
- Polish all P0 pages。
- Generate screenshots。

## P1.1 管理员操作日志

状态：已完成。

- `/admin/audit` 操作日志页。
- 支持关键词、操作者类型、面试组筛选。
- 超级管理员可查看全量日志。
- 建组、组设置、时间段生成、候选人提交、修改申请、审核、预约、取消预约、管理员私有备注均写入审计日志。
- 完整业务 E2E 已校验关键审计记录。

## P1.2 安全和运维升级

状态：已完成。

- 候选人通过一次性邮箱访问链接进入，页面不再依赖 URL query 中的姓名/邮箱。
- 普通管理员可登录后台，并通过 `AdminGroupMembership` 限制面试组访问和操作角色。
- 负责人通知改为 `EmailOutbox` 入队并由脚本/systemd timer 处理。
- 正式预约结束时间使用面试组 `interviewDurationMinutes` 计算。
- 新增 `/api/health/ready` 数据库就绪检查。

## P2.1 招聘项目和轮次底座

状态：已完成。

- 新增 `InterviewProject`、`InterviewRound`、`Interviewer`、`AppointmentInterviewer` 数据模型。
- `0009_projects_rounds_interviewers` 迁移会把历史面试组回填为项目和默认轮次。
- 创建面试组时同步创建项目和默认轮次。
- 预约和改约写入 `Appointment.roundId`。
- 后台新增 `/admin/projects` 项目列表和 `/admin/projects/[id]` 项目详情。
- 项目详情支持维护项目级面试官池。
- 项目权限派生自项目下任一面试组的 `AdminGroupMembership`。

## P2.2 多面试官排期冲突检测

状态：已完成。

- 预约时选择一个或多个面试官。
- 基于 `AppointmentInterviewer` 检测同一面试官的重叠安排。
- 改约时保留并可调整面试官，冲突检测会排除当前预约自身。
- 候选人详情、组内预约列表、全局预约列表展示已指定面试官。

## P2.3 项目排期视图

状态：待做。

- 项目详情增加按面试官/轮次查看排期占用。
- 支持按面试官筛选项目内预约。
