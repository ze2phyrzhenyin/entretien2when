# 邮件运营验收说明

本项目通过 Mailato 发送候选人邮件。邮件能力只在管理员端出现，候选人端不会暴露发送入口、服务商配置或管理员发送记录。

## 线上配置

- 应用通过 `MAILATO_COMMAND` 调用服务器上的 Mailato wrapper。
- 线上建议 `MAILATO_COMMAND=/usr/local/bin/mailato`。
- 邮箱 provider、发件域名、API key 或 SMTP 密码保存在 `/etc/mailato/mailato.env`。
- 本仓库只保留变量名和说明，不提交真实密钥。
- 本地或演练环境可设置 `MAILATO_DRY_RUN=true`，真实发送环境设为 `false`。
- `CANDIDATE_ACCESS_ENCRYPTION_KEY` 必须是 32 字节 base64url 密钥；候选人一次性链接正文加密后才进入 outbox。
- 候选人邮件、访问链接、面试官通知和日历提醒都先持久化，再由 worker 投递；页面请求不等待邮件服务。
- 面试安排、改约和取消会为候选人及面试官生成 ICS 附件与 Google/Outlook 快捷链接；默认在 24 小时和 1 小时前提醒，可用 `APPOINTMENT_REMINDER_HOURS` 调整。
- 候选人提交可用时间、提交修改申请，或管理员安排正式预约后，会向该面试组中处于 `ACTIVE` 状态的 `OWNER` 管理员发送通知邮件。
- 收件人只从组成员关系解析；不读取 `OWNER_NOTIFICATION_EMAILS`，也绝不回退到个人或全局邮箱。若组内没有活跃 OWNER，系统记录 `system.owner_notification_not_queued` 审计事件而不外发候选人信息；管理员应先补齐组 OWNER 再继续运营。

## 小流量真实邮件验收

1. 在后台面试组中准备一个测试候选人，邮箱使用可控测试邮箱。
2. 先在服务器确认 Mailato 可用：

   ```bash
   mailato --version
   mailato doctor
   ```

3. 确认应用环境：

   ```bash
   grep '^MAILATO_' /etc/when2entretien/when2entretien.env
   ```

4. 进入候选人详情页，选择“面试安排通知”模板。
5. 检查发送前预览，勾选确认后只发送给测试候选人。
6. 在候选人详情页查看“邮件发送历史”：
   - `已发送`：真实发送成功。
   - `预览`：当前仍为 dry-run。
   - `失败`：可查看管理员可见失败原因，并点击重试。
7. 在测试邮箱中检查：
   - 中文主题和正文是否正常。
   - 发件人名称和域名是否正确。
   - 是否进入收件箱、垃圾箱或被拒收。

## 批量发送规则

- 批量发送按候选人逐封发送，不使用公开 `To` 或 `Cc` 列表。
- 一次最多选择 50 位候选人。
- 发送前必须勾选确认。
- 批量发送后页面会显示本次批次结果，失败原因仅管理员可见。
- 审计日志只记录动作、主题、候选人 id、结果数量和发送记录 id，不记录邮件正文或邮件密钥。

## 回滚和排查

- 如果需要暂停真实发送，将 `/etc/when2entretien/when2entretien.env` 中 `MAILATO_DRY_RUN` 改为 `true`，然后重启 `when2entretien-web.service`。
- 如果 Mailato 配置异常，候选人详情页的失败记录可以在修复配置后重试。
- `when2entretien-web-email-outbox.timer` 每分钟处理所有待发邮件、到期提醒并回收过期 lease；可手动执行 `pnpm email:outbox` 进行受控排查。
- `pnpm data:prune` 只预览到期记录；确认组织的数据保留政策后使用 `pnpm data:prune -- --confirm` 删除。默认认证记录 7 天、邮件内容 90 天、审计 365 天。
- 不要把 `/etc/mailato/mailato.env` 内容复制进 issue、PR、截图或 git。
