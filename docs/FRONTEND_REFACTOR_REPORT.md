# Frontend Foundation Refactor Report

任务：Frontend Foundation Refactor for Interview Scheduler CN

## 重构目标

- 在不破坏 P0 主流程、权限、隐私隔离、修改审核和预约锁定逻辑的前提下，统一前端设计系统和组件结构。
- 提升候选人端的清晰度、可信度和移动端可用性。
- 提升管理员端的信息密度、审计可追溯性和操作效率。
- 接入 Mailato，让管理员可从候选人列表批量选择收件人，或在候选人详情页单独发送邮件。
- 部署到 Aliyun 远端，并在 `http://120.24.108.234/` 增加项目入口卡片。

## 主要修改文件

- 设计系统与样式：`docs/UI_DESIGN_SYSTEM.md`、`src/styles/globals.css`、`tailwind.config.ts`
- 前端审计：`docs/FRONTEND_REFACTOR_AUDIT.md`
- 部署说明：`docs/DEPLOYMENT.md`
- 部署脚本：`scripts/deploy-aliyun.sh`
- 截图脚本：`scripts/ui-snapshots.sh`、`tests/e2e/ui-snapshots.spec.ts`
- 邮件集成：`src/lib/mail/mailato.ts`、`src/lib/validation/email.ts`、`src/server/actions/email.ts`
- 候选人页面：`src/app/join/*`、`src/app/candidate/[groupCode]/*`
- 管理员页面：`src/app/admin/**/*`
- 组件目录：`src/components/ui/*`、`src/components/design-system/*`、`src/components/layout/*`、`src/components/scheduling/*`、`src/components/candidate/*`、`src/components/admin/*`

## 新增或重构组件

- UI 原子组件：`Button`、`Input`、`Textarea`、`Select`、`Checkbox`、`Card`、`Badge`、`Table`、`Alert`、`Dialog`、`Popover`、`Tabs`、`Skeleton`、`EmptyState`、`ErrorState`、`LoadingState`
- 设计系统组件：`PageHeader`、`SectionHeader`、`MetricCard`、`StatusBadge`、`FormField`、`ConfirmDialog`、`InlineNotice`、`PrivacyNotice`、`ReviewNotice`、`AdminOnlyNotice`
- 布局组件：`CandidateShell`、`AdminShell`、`AdminSidebar`、`AdminTopbar`、`AdminContent`、`AuthLayout`、`CenteredCardLayout`
- 时间组件：`CandidateTimeGrid`、`AdminTimeGrid`、`TimeCell`、`SlotLegend`、`SelectedSlotsSummary`、`TimeRangePreview`
- 候选人组件：`CandidateIdentityCard`、`CandidateSubmittedSummary`、`CandidateAppointmentCard`
- 管理员组件：`CandidateAdminNoteEditor`、`CandidateEmailComposer`、`ReviewComparison`

## 页面改进

- 候选人端：`/join`、首次提交、已提交、修改申请、待审核、面试安排页完成统一视觉和状态表达。
- 管理员端：登录、工作台、设置、时间段、候选人列表、候选人详情、修改审核、时间总览、预约列表、审计页完成统一布局。
- 新增通用 `loading`、`error`、`not-found` 状态。
- 候选人端时间格只接收候选人安全 DTO，不接收锁定原因、候选人数量或管理员字段。
- 管理员端可见锁定原因、候选人数、私有备注和邮件发送入口，并明确标注“仅管理员可见”。

## Mailato 集成

- 本地 `mailato` 已扩展支持无附件纯文本邮件，并部署到远端 `/usr/local/bin/mailato`。
- 当前项目通过 `MAILATO_COMMAND` 调用 Mailato；远端复用 `/etc/mailato/mailato.env`，不复制邮箱密钥到本仓库。
- 候选人列表支持勾选候选人后批量发送；候选人详情支持单独发送。
- 批量发送按候选人逐个发送，收件人之间互不可见。
- 审计日志记录发送批次、主题、候选人 id、成功/失败数量，不记录邮件正文和邮箱服务密钥。

## 隐私检查结果

- 候选人路由、候选人组件、候选人 DTO 中未发现：
  - `adminNotes`
  - `internalNote`
  - `reasonInternal`
  - `availableCandidateCount`
  - `otherCandidates`
  - `CandidateAdminNote`
  - `管理员私有备注`
- 候选人 E2E 覆盖：候选人端不显示管理员内部备注、管理员私有备注、锁定原因和其他候选人。
- 单元测试覆盖：候选人 self DTO 不序列化敏感字段。

## UI 截图

截图目录：

`artifacts/ui-snapshots/frontend-refactor-p0/`

生成截图 18 张，包含：

- 候选人端：`join`、`candidate-first-submit`、`candidate-submitted`、`candidate-modification`、`candidate-pending-review`、`candidate-appointment`
- 管理员端：`admin-login`、`admin-dashboard`、`group-settings`、`group-slots`、`candidate-list`、`candidate-detail`、`review-detail`、`time-overview`、`appointments`
- 移动端：`mobile-join`、`mobile-candidate-first-submit`

## 测试结果

- `pnpm check`：通过
- `pnpm exec playwright test tests/e2e/business-flow.spec.ts --project=chromium`：通过
- `bash scripts/ui-snapshots.sh`：通过
- 远端 Mailato 无附件 dry-run：通过
- Aliyun 部署健康检查：`http://120.24.108.234/when2entretien/api/health` 通过
- Portal 卡片检查：`http://120.24.108.234/` 已显示 `Interview Scheduler CN`

## 远端部署

- 公开入口：`http://120.24.108.234/when2entretien`
- systemd 服务：`when2entretien-web.service`
- 应用目录：`/opt/when2entretien/current`
- 环境文件：`/etc/when2entretien/when2entretien.env`
- 邮件配置复用：`/etc/mailato/mailato.env`

真实管理员密码、数据库密码和邮件密钥只保存在远端 env 文件中，未提交到 git。

## 后续 polish

- 可以进一步把邮件正文模板做成可保存的管理员模板，但这属于 P1/P2 功能。
- 管理员时间总览可继续加侧边详情抽屉，用于从时间格直接安排面试。
- 可补充更多移动端管理员页面截图，但当前管理员端优先桌面。
