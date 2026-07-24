# Data Model

核心模型定义见 `prisma/schema.prisma`。

## 主要实体

- `Admin`：管理员账号，邮箱唯一，密码以 scrypt hash 存储。
- `AdminSession`：管理员 httpOnly cookie 对应的 token hash。
- `AdminGroupMembership`：普通管理员到面试组的授权关系，角色为 `OWNER`、`SCHEDULER`、`REVIEWER`、`VIEWER`。
- `InterviewProject`：招聘项目，用于组织轮次、面试组和面试官池；历史面试组通过 `0009_projects_rounds_interviewers` 自动回填为一组项目和默认轮次。
- `InterviewRound`：项目内面试轮次；当前建组流程自动创建“默认轮次”，并保存该轮次的面试时长。
- `Interviewer`：项目级面试官池，按 `projectId + normalizedEmail` 唯一；它是项目内授权 `OWNER`/`SCHEDULER` 共享的排期资源，不授予跨组候选人数据访问。
- `InterviewGroup`：面试组，包含复杂随机 groupCode、timezone、规则配置。
- `GroupTimeSlot`：组内开放时间段，UTC 存储。
- `TimeSlotLock`：时间锁。`activeSlotId @unique` 表示同一 slot 未释放时只能有一个活动锁；释放时置空并写 `releasedAt`。
- `Candidate`：组内候选人，`groupId + normalizedEmail` 唯一。
- `CandidateAccessToken`：候选人一次性邮箱访问链接 token hash，过期或消费后不可复用。
- `CandidateSession`：候选人 httpOnly cookie 对应的 token hash，绑定面试组和 normalizedEmail。
- `CandidateSubmission`：候选人提交版本，初次提交 ACTIVE，修改先 PENDING_REVIEW。
- `CandidateSubmission.pendingReviewCandidateId`：仅待审核修改写入 candidateId，审核结束置空，用唯一约束保证同一候选人最多一个待审核修改。
- `CandidateSubmissionSlot`：提交版本选择的 slot。
- `Appointment` / `AppointmentSlot`：管理员安排的面试及覆盖 slot；`Appointment.roundId` 记录本次安排所属轮次。
- `AppointmentInterviewer`：预约和项目面试官的关联表；预约/改约时用该表检测同一面试官的重叠安排。
- `CandidateAdminNote`：管理员私有备注，语义固定 ADMIN_ONLY。
- `AdminNotification`：修改审核等后台通知。
- `CandidateEmailDelivery` / `EmailTemplate`：候选人通知发送记录和邮件模板覆盖项。每个新投递先持久化 `PROCESSING` 记录和唯一 provider idempotency key，外发后才更新结果。
- `EmailOutbox`：异步邮件队列，目前用于负责人通知的入队、重试和失败记录；`leaseExpiresAt` 让崩溃的 worker claim 可以恢复。
- `AuditLog`：管理员、候选人、系统动作审计；`groupId` 为空表示全局动作，非空时按面试组做权限隔离和筛选。

## 时间规则

- 数据库存储统一 UTC。
- 前端展示使用 InterviewGroup.timezone，默认 `Asia/Shanghai`；全局混合组列表必须逐行显示所属组时区。
- `GroupTimeSlot.startAt/endAt` 采用 UTC DateTime。
- 本地墙上时间转 UTC 会拒绝 DST 不存在时间和未明确消歧的重复时间，避免把同一显示时间悄悄存成错误 instant。
- `Appointment.startAt/endAt` 表示正式面试时间；`endAt` 使用 `InterviewGroup.interviewDurationMinutes` 计算，`AppointmentSlot`/`TimeSlotLock` 表示被锁定的可用窗口。
- 面试官冲突检测使用 `Appointment.startAt < newEndAt AND Appointment.endAt > newStartAt` 的重叠规则，并只检查 `SCHEDULED` 状态。

## 一致性规则

- groupCode 数据库唯一。
- `AdminGroupMembership` 在 `adminId + groupId` 唯一。
- `InterviewRound` 在 `projectId + orderIndex` 唯一。
- `Interviewer` 在 `projectId + normalizedEmail` 唯一。
- `GroupTimeSlot` 在 `groupId + startAt + endAt` 唯一。
- `GroupTimeSlot` 还有 `[startAt,endAt)` 的组内 exclusion constraint 和 `endAt > startAt` check，禁止部分重叠 slot。
- `Candidate` 在 `groupId + normalizedEmail` 唯一。
- `CandidateAccessToken.tokenHash` 和 `CandidateSession.tokenHash` 唯一。
- `CandidateSubmissionSlot` 在 `submissionId + slotId` 唯一。
- `AppointmentSlot` 在 `appointmentId + slotId` 唯一。
- `AppointmentInterviewer` 在 `appointmentId + interviewerId` 唯一。
- `Appointment` 有 `endAt > startAt` check，并通过部分唯一索引保证每个候选人至多一条 `SCHEDULED` 预约；面试官重叠由数据库触发器和事务锁共同拒绝。
- 活动 slot lock 通过 `TimeSlotLock.activeSlotId @unique` 保证。
- `AuditLog.groupId + createdAt` 用于后台操作日志按面试组过滤。
