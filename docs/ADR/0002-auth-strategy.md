# ADR 0002：Auth Strategy

日期：2026-07-01

## 状态

Accepted

## 决策

管理员认证使用邮箱 + 密码。密码使用 Node.js `crypto.scrypt` 加盐 hash 存储。登录成功后创建随机 session token，数据库只存 token hash，浏览器使用 httpOnly cookie 保存 token。

## 默认假设

- P0 不接 OAuth、不接 SSO。
- Session TTL 默认 7 天，可由 `SESSION_TTL_DAYS` 配置。
- 登录错误统一提示“邮箱或密码不正确”，不暴露账号是否存在。

## 后果

- 所有后台页面和 API 必须 `requireAdmin`。
- 组级操作必须继续检查 GroupAdmin 权限。
- `.env` 只存 bootstrap 管理员初始信息和数据库连接，不提交仓库。
