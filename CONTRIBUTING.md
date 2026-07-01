# Contributing

所有开发必须遵循 `docs/ENGINEERING_LOOP.md`。

## 基本纪律

- 不提交 `.env`、数据库 dump、截图中的真实个人信息。
- 涉及候选人、管理员备注、锁定原因、审核状态时，先检查 `docs/PRD.md`、`docs/PRIVACY_MODEL.md`、`docs/AUTH_AND_PERMISSIONS.md`。
- 涉及 Prisma schema 或数据访问时，检查 `.agents/skills/database-migration-guard/SKILL.md`。
- 涉及 UI 时，检查 `.agents/skills/ui-quality-gate/SKILL.md`。
- 提交前运行 `pnpm check`，若失败不得标记任务完成。

## Commit

使用 Conventional Commits，例如：

```text
chore: bootstrap project framework
feat: add admin authentication
test: add privacy and permission tests
```
