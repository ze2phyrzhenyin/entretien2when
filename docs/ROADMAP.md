# Roadmap

当前状态：P0.0-P0.7 已实现并通过 `pnpm check`；P0.8 已有截图证据，正在做人工验收和收尾打磨。

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

状态：验收中。

- Run ui-quality-gate skill。
- Polish all P0 pages。
- Generate screenshots。
