# API Contracts

可以使用 Next.js server actions 或 route handlers，但必须分清 admin API 和 candidate API。

## 候选人接口

- `joinGroup(input: name, email, groupCode)`
- `getCandidateSelfView(groupCode, email)`
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
- `createGroup()`
- `updateGroup()`
- `generateGroupCode()`
- `listGroupCandidates()`
- `getCandidateAdminDetail()`
- `upsertCandidateAdminNote()`
- `listPendingReviews()`
- `reviewSubmission()`
- `listTimeOverview()`
- `scheduleAppointment()`
- `cancelAppointment()`
- `listAppointments()`
- `sendMailatoEmail()`

所有 admin 接口必须 `requireAdmin`。当前 `requireAdmin` 只允许超级管理员进入后台；候选人接口不复用管理员 session。

## DTO 分离

- `AdminCandidateDTO` 可以包含候选人备注、管理员私有备注、内部锁定原因。
- `CandidateSelfDTO` 绝对不能包含 adminNotes、internalNote、reasonInternal、availableCandidateCount。
