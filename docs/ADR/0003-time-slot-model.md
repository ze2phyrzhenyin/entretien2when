# ADR 0003：Time Slot Model

日期：2026-07-01

## 状态

Accepted

## 决策

面试组通过 `GroupTimeSlot` 定义候选可选时间段。时间统一 UTC 存储，前端按 `InterviewGroup.timezone` 展示，默认 `Asia/Shanghai`。

活动锁使用 `TimeSlotLock.activeSlotId @unique` 表达：未释放锁的 `activeSlotId` 等于 `slotId`；释放锁时写入 `releasedAt` 并将 `activeSlotId` 置空。

## 默认假设

- P0 候选人可选时间段默认 60 分钟，面试默认 30 分钟。
- 面试时长必须短于候选人可选时间段长度。
- 管理员安排面试可以选择一个或多个连续 slot。
- 不在候选人端展示锁定原因。

## 后果

- double-booking 必须通过事务和唯一约束共同防止。
- 审核修改和预约前必须重新校验 slot OPEN 且无活动锁。
