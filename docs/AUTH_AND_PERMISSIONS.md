# Auth And Permissions

## 管理员认证

- 管理员登录使用邮箱 + 密码。
- 密码使用 Node.js `crypto.scrypt` 加盐 hash 存储。
- session token 只以明文放在 httpOnly cookie；数据库只存 token hash。
- cookie 设置 `httpOnly`、`sameSite=lax`，生产环境启用 `secure`。
- 错误提示不暴露账号是否存在。

## 权限规则

- 超级管理员可以访问所有面试组。
- 普通管理员只能访问 GroupAdmin 授权的面试组。
- 普通管理员能否编辑组、审核修改、安排面试，取决于 GroupAdmin 权限字段。
- 候选人没有后台权限。
- 候选人通过 groupCode + email 识别自己在某组内的记录。
- 服务端必须二次校验权限，不能只靠前端隐藏按钮。

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
