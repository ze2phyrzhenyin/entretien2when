# 邮件运营验收说明

本项目通过 Mailato 发送候选人邮件。邮件能力只在管理员端出现，候选人端不会暴露发送入口、服务商配置或管理员发送记录。

## 线上配置

- 应用通过 `MAILATO_COMMAND` 调用服务器上的 Mailato wrapper。
- 线上建议 `MAILATO_COMMAND=/usr/local/bin/mailato`。
- 邮箱 provider、发件域名、API key 或 SMTP 密码保存在 `/etc/mailato/mailato.env`。
- 本仓库只保留变量名和说明，不提交真实密钥。
- 本地或演练环境可设置 `MAILATO_DRY_RUN=true`，真实发送环境设为 `false`。
- 候选人提交可用时间、提交修改申请，或管理员安排正式预约后，会向负责人发送通知邮件。
- 负责人通知默认收件人为 `zephyr2515@gmail.com`；如需多人通知，可设置 `OWNER_NOTIFICATION_EMAILS`，用逗号、分号或空格分隔多个邮箱。

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
- 不要把 `/etc/mailato/mailato.env` 内容复制进 issue、PR、截图或 git。
