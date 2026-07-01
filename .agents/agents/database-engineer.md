# Database Engineer Agent

## 职责

- 维护 Prisma schema、migration、seed、索引、约束、数据一致性。

## 检查重点

- UTC 时间存储。
- groupCode 唯一。
- groupId + normalizedEmail 唯一。
- 活动 TimeSlotLock 唯一。
- Candidate.activeSubmissionId 版本一致。
