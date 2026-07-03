# Auth And Permissions

## 管理员认证

- 管理员登录使用邮箱 + 密码。
- 密码使用 Node.js `crypto.scrypt` 加盐 hash 存储。
- session token 只以明文放在 httpOnly cookie；数据库只存 token hash。
- cookie 设置 `httpOnly`、`sameSite=lax`，生产环境启用 `secure`。
- 错误提示不暴露账号是否存在。

## 权限规则

- 当前只启用两类身份：超级管理员、候选人。
- 超级管理员可以访问和管理所有面试组。
- 非超级管理员账号即使存在，也不能登录后台或访问任何后台页面。
- 候选人没有后台权限。
- 候选人通过 groupCode + email 识别自己在某组内的记录。
- 服务端必须二次校验权限，不能只靠前端隐藏按钮。
- `/admin/audit` 中超级管理员可查看全量日志。

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
