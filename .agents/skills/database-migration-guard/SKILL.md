# database-migration-guard

## 触发

凡是修改 Prisma schema 或数据访问逻辑时触发。

## 检查

- migration 是否存在且可运行。
- 索引、唯一约束、外键是否符合业务。
- 时间是否 UTC 存储。
- 活动锁是否唯一。
- 候选人 active submission 版本是否一致。
- 组编号是否数据库唯一。
