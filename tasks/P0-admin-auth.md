# P0 Admin Auth

范围：

- `/admin/login`
- 邮箱 + 密码。
- scrypt password hash。
- httpOnly session。
- `requireAdmin`。
- seed super admin。
- create-admin script。

验收：

- 密码不明文存储。
- 登录错误不暴露账号存在性。
- 未登录访问 `/admin` 跳转登录。
