# interview-scheduler-cn

中文版面试时间管理系统。目标是提供隐私隔离型 when2meet / scheduling 产品：候选人只能提交和查看自己的面试时间，管理员统一审核修改、安排面试并锁定已预约时间。

## 快速开始

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## 常用命令

```bash
pnpm check
pnpm test
pnpm test:e2e
pnpm doctor
```

## 当前阶段

- P0.0：项目脚手架、AI 开发框架、Prisma 数据模型、基础 UI 与 CI。
- P0.1：管理员邮箱密码登录、httpOnly session、密码 scrypt hash、超级管理员 seed/create-admin 脚本。

完整产品、权限、隐私、测试和工程循环见 `docs/`。
