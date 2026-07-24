# Auth And Permissions

## 管理员认证

- 管理员登录使用邮箱 + 密码。
- 密码使用 Node.js `crypto.scrypt` 加盐 hash 存储。
- session token 只以明文放在 httpOnly cookie；数据库只存 token hash。
- cookie 设置 `httpOnly`、`sameSite=lax`、生产环境强制 `secure`，并只作用于 `NEXT_PUBLIC_BASE_PATH`，不泄露给同域其他应用。
- 生产环境 `APP_URL` 必须是可信 HTTPS 地址，且其路径必须与 `NEXT_PUBLIC_BASE_PATH` 完全一致；HTTP 入口只能 301/308 跳转到 HTTPS。
- 若 TLS 在受信任反向代理终止，才设置 `TRUST_PROXY=true`，且反向代理必须覆盖 `X-Real-IP`。
- 错误提示不暴露账号是否存在。

## 权限规则

- 当前启用三类后台访问形态：超级管理员、组级管理员、候选人。
- 超级管理员可以访问和管理所有面试组。
- 普通 `ADMIN` 可以登录后台，但只能访问 `AdminGroupMembership` 授权的面试组。
- 面试组是候选人、预约、审核、统计和管理员备注的安全边界；普通管理员绝不能借由项目入口读取未授权组的这些数据。
- `InterviewProject` 只把项目级面试官池作为明确共享的排期资源：项目内任一授权组的 `OWNER`/`SCHEDULER` 可维护和读取该池，仍只会看到自己有权组的轮次、组和统计；`VIEWER`/`REVIEWER` 不读取其他组的项目数据或面试官邮箱。
- 项目与轮次元数据不是组设置的副作用：组 `OWNER` 只能更新本组字段，不能通过本组设置改写可能被其他组共享的项目或轮次；共享元数据变更必须走显式的超级管理员流程。
- 若业务不允许组间共享面试官池，必须拆分为不同项目；当前项目模型不是跨组候选人信息的授权通道。
- 组级角色包括 `OWNER`、`SCHEDULER`、`REVIEWER`、`VIEWER`。
- 组设置和审计日志仅 `OWNER` 可访问；时间段和预约由 `OWNER`/`SCHEDULER` 操作；修改审核由 `OWNER`/`REVIEWER` 操作；`VIEWER` 只可查看候选人基础列表。
- 候选人没有后台权限。
- 候选人通过 `/join` 请求一次性邮箱访问链接；邮件 GET 只显示确认页，只有确认 POST 会原子消费链接并创建 httpOnly candidate session。
- 负责人邮件只发给目标面试组的活跃 `OWNER`；没有活跃 OWNER 时写系统审计失败记录，绝不回退发送到个人或全局邮箱。
- 候选人页面不再通过 URL query 传递姓名或邮箱。
- 服务端必须二次校验权限，不能只靠前端隐藏按钮。
- `/admin/audit` 中超级管理员可查看全量日志；普通管理员仅能查看自己作为 `OWNER` 的组日志。

## 敏感字段

候选人端不能看到：

- 任何其他候选人数据。
- 锁定原因。
- `CandidateAdminNote`。
- `GroupTimeSlot.internalNote`。
- `Appointment.internalNote`。
- audit logs。
- admin emails。
- 可用候选人人数。
