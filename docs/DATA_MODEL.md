# Data Model

核心模型定义见 `prisma/schema.prisma`。

## 主要实体

- `Admin`：管理员账号，邮箱唯一，密码以 scrypt hash 存储。
- `AdminSession`：管理员 httpOnly cookie 对应的 token hash。
- `InterviewGroup`：面试组，包含复杂随机 groupCode、timezone、规则配置。
- `GroupAdmin`：普通管理员对面试组的授权和能力字段。
- `GroupTimeSlot`：组内开放时间段，UTC 存储。
- `TimeSlotLock`：时间锁。`activeSlotId @unique` 表示同一 slot 未释放时只能有一个活动锁；释放时置空并写 `releasedAt`。
- `Candidate`：组内候选人，`groupId + normalizedEmail` 唯一。
- `CandidateSubmission`：候选人提交版本，初次提交 ACTIVE，修改先 PENDING_REVIEW。
- `CandidateSubmissionSlot`：提交版本选择的 slot。
- `Appointment` / `AppointmentSlot`：管理员安排的面试及覆盖 slot。
- `CandidateAdminNote`：管理员私有备注，语义固定 ADMIN_ONLY。
- `AdminNotification`：修改审核等后台通知。
- `AuditLog`：管理员、候选人、系统动作审计。

## 时间规则

- 数据库存储统一 UTC。
- 前端展示使用 InterviewGroup.timezone，默认 `Asia/Shanghai`。
- `GroupTimeSlot.startAt/endAt` 采用 UTC DateTime。

## 一致性规则

- groupCode 数据库唯一。
- `GroupTimeSlot` 在 `groupId + startAt + endAt` 唯一。
- `GroupAdmin` 在 `groupId + adminId` 唯一。
- `Candidate` 在 `groupId + normalizedEmail` 唯一。
- `CandidateSubmissionSlot` 在 `submissionId + slotId` 唯一。
- `AppointmentSlot` 在 `appointmentId + slotId` 唯一。
- 活动 slot lock 通过 `TimeSlotLock.activeSlotId @unique` 保证。
