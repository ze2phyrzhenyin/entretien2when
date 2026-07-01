# Roadmap

当前状态：P0 主流程已完成并通过发布验收；P1 已开始，管理员操作日志页已实现。

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
- 超级管理员可查看全量日志；普通管理员按已授权面试组和自己发起的操作查看。
- 建组、组设置、授权、时间段生成、候选人提交、修改申请、审核、预约、取消预约、管理员私有备注均写入审计日志。
- 完整业务 E2E 已校验关键审计记录。
