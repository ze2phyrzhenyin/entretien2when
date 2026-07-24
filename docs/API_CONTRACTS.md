# API Contracts

可以使用 Next.js server actions 或 route handlers，但必须分清 admin API 和 candidate API。

## 候选人接口

- `requestCandidateAccess(input: name, email, groupCode)`
- `consumeCandidateAccessToken(token)`
- `getCandidateSelfView(groupCode, candidateSession)`
- `submitInitialAvailability(...)`
- `requestSubmissionModification(...)`
- `getCandidateReviewStatus(...)`
- `getCandidateAppointment(...)`

候选人 self view 返回字段不得包含：

- other candidates
- lock reason
- admin private notes
- internal notes
- audit logs
- admin emails
- available candidate counts

## 管理员接口

- `adminLogin(email, password)`
- `adminLogout()`
- `listGroups()`
- `listProjects()`
- `getProjectDetail()`
- `createGroup()`
- `updateGroup()`
- `upsertInterviewer()`
- `generateGroupCode()`
- `listGroupCandidates()`
- `getCandidateAdminDetail()`
- `upsertCandidateAdminNote()`
- `listPendingReviews()`
- `reviewSubmission()`
- `listTimeOverview()`
- `scheduleAppointment(slotIds, interviewerIds?, meetingLocation?, candidateVisibleMessage?, internalNote?, email fields...)`
- `cancelAppointment()`
- `listAppointments()`
- `sendMailatoEmail()`

所有 admin 接口必须 `requireAdmin`。超级管理员可访问全量后台数据；普通管理员必须继续经过 group/project permission helper 做服务端二次校验。候选人接口不复用管理员 session。

`scheduleAppointment` 和 `rescheduleAppointment` 必须校验：

- `slotIds` 属于候选人当前有效提交，且连续、开放、未被其他预约锁定。
- `interviewerIds` 属于当前面试组关联项目，且面试官状态为 `ACTIVE`。
- 所选面试官没有与目标时间重叠的 `SCHEDULED` 预约。

## DTO 分离

- `AdminCandidateDTO` 可以包含候选人备注、管理员私有备注、内部锁定原因。
- `CandidateSelfDTO` 绝对不能包含 adminNotes、internalNote、reasonInternal、availableCandidateCount。
