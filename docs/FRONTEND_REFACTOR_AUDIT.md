# Frontend Foundation Refactor Audit

任务名称：Frontend Foundation Refactor for Interview Scheduler CN

审计日期：2026-07-01

本审计只覆盖重构前现状，不修改页面实现。已阅读：

- `docs/PRD.md`
- `docs/UI_REFERENCE_RESEARCH.md`
- `docs/UI_DESIGN_SYSTEM.md`
- `docs/PRIVACY_MODEL.md`
- `docs/AUTH_AND_PERMISSIONS.md`
- `docs/ENGINEERING_LOOP.md`
- `.agents/skills/ui-quality-gate/SKILL.md`
- `.agents/skills/auth-security-guard/SKILL.md`
- `.agents/skills/code-review-gate/SKILL.md`

结论：现有文档存在且足以开始 Step 1。`docs/UI_DESIGN_SYSTEM.md` 内容可用但偏基础，后续 Step 2 需要扩展为更完整的 token、组件、状态和验收规范。

## 1. 当前页面清单

### 候选人端

- `/`：入口选择页，提供候选人入口和管理员入口。
- `/join`：候选人填写姓名、邮箱、面试组编号。
- `/candidate/[groupCode]`：同一路由承载多个候选人状态：
  - 首次提交页。
  - 已提交页。
  - 修改申请页，依赖 `mode=modify`。
  - 修改审核中提示，依赖 `pending=1` 或 pending submission。
  - 面试已安排页，候选人只看到自己的预约信息。
  - 错误状态：面试组不存在、身份信息缺失。

### 管理员端

- `/admin/login`：管理员邮箱密码登录。
- `/admin`：管理员工作台和面试组列表。
- `/admin/audit`：操作日志页。
- `/admin/groups/new`：创建面试组。
- `/admin/groups/[id]/settings`：面试组设置、候选人入口、普通管理员授权。
- `/admin/groups/[id]/slots`：批量生成时间段、时间段列表、开放/关闭操作。
- `/admin/groups/[id]/candidates`：候选人列表、搜索、状态筛选。
- `/admin/groups/[id]/candidates/[candidateId]`：候选人详情、当前可用时间、安排面试、提交历史、管理员私有备注。
- `/admin/groups/[id]/reviews`：组内修改审核列表。
- `/admin/groups/[id]/reviews/[submissionId]`：修改审核详情和通过/拒绝操作。
- `/admin/groups/[id]/overview`：时间总览。
- `/admin/groups/[id]/appointments`：预约列表和取消预约。

### 缺失的路由级状态页

- 当前没有任何 `loading.tsx`、`error.tsx`、`not-found.tsx`。
- 权限拒绝现在多处直接 `throw new Error("没有权限访问该面试组。")`，缺少专业错误页。
- 表单提交过程主要依赖浏览器/server action 状态，页面级 loading、error、success 体系不足。

## 2. 当前组件清单

### 已有基础组件

| 组件           | 文件                                  | 现状判断                                                   | 后续动作                              |
| -------------- | ------------------------------------- | ---------------------------------------------------------- | ------------------------------------- |
| `Button`       | `src/components/ui/button.tsx`        | 有 variant，但尺寸、loading、防跳动、icon spacing 不完整。 | 保留并重构。                          |
| `Input`        | `src/components/ui/input.tsx`         | 高度统一，focus 只有 border，错误态缺失。                  | 保留并扩展状态。                      |
| `Textarea`     | `src/components/ui/textarea.tsx`      | 基础可用，错误态和 helper text 缺失。                      | 保留并扩展。                          |
| `Select`       | `src/components/ui/select.tsx`        | 基础可用，但页面里仍有原生 `<select>`。                    | 保留并统一替换原生 select。           |
| `Label`        | `src/components/ui/label.tsx`         | 基础可用。                                                 | 保留，纳入 `FormField`。              |
| `Card`         | `src/components/ui/card.tsx`          | 只有一种外观，当前 shadow 偏模板化。                       | 保留并增加 header/body/section 语义。 |
| `Badge`        | `src/components/ui/badge.tsx`         | 语义有限，颜色偏散。                                       | 保留并由 `StatusBadge` 包装。         |
| `CopyButton`   | `src/components/ui/copy-button.tsx`   | 基础可用，有复制反馈。                                     | 保留，增加错误 fallback 和固定宽度。  |
| `EmptyState`   | `src/components/ui/empty-state.tsx`   | 基础可用。                                                 | 保留，增加 icon/action/紧凑模式。     |
| `SubmitButton` | `src/components/ui/submit-button.tsx` | 基础 pending 状态。                                        | 保留，统一用于 server action 表单。   |

### 已有布局组件

| 组件            | 文件                                        | 现状判断                                                                   | 后续动作                                             |
| --------------- | ------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------- |
| `AdminShell`    | `src/components/layout/admin-shell.tsx`     | sidebar/topbar 可用，但移动端只隐藏 sidebar，无 mobile nav；仍有占位导航。 | 拆成 `AdminSidebar`、`AdminTopbar`、`AdminContent`。 |
| `GroupAdminNav` | `src/components/layout/group-admin-nav.tsx` | 横向 tab 可用。                                                            | 保留并升级为统一 tabs/nav。                          |

### 缺失但本次重构需要的新组件

- `components/design-system/`
  - `PageHeader`
  - `SectionHeader`
  - `MetricCard`
  - `StatusBadge`
  - `FormField`
  - `InlineNotice`
  - `PrivacyNotice`
  - `ReviewNotice`
  - `AdminOnlyNotice`
  - `ConfirmDialog`
- `components/layout/`
  - `CandidateShell`
  - `AdminSidebar`
  - `AdminTopbar`
  - `AdminContent`
  - `AuthLayout`
  - `CenteredCardLayout`
- `components/scheduling/`
  - `TimeGrid`
  - `CandidateTimeGrid`
  - `AdminTimeGrid`
  - `TimeCell`
  - `SlotLegend`
  - `SelectedSlotsSummary`
  - `TimeRangePreview`
  - `SlotPopover` 或轻量详情面板
- `components/candidate/`
  - `JoinForm`
  - `CandidateIdentityCard`
  - `CandidateSubmissionForm`
  - `CandidateSubmittedSummary`
  - `CandidateModificationWarning`
  - `CandidateReviewStatus`
  - `CandidateAppointmentCard`
  - `CandidateNoteField`
- `components/admin/`
  - `AdminLoginForm`
  - `GroupList`
  - `GroupSettingsForm`
  - `SlotGenerationForm`
  - `CandidateTable`
  - `CandidateDetailHeader`
  - `CandidateAvailabilityPanel`
  - `CandidateAdminNoteEditor`
  - `ReviewComparison`
  - `AppointmentForm`
  - `AppointmentList`
  - `PermissionEditor`
  - `AdminStatsBar`

### 缺失的基础 UI 原子

- `Table`
- `Checkbox`
- `Dialog`
- `Sheet`
- `Popover`
- `Alert`
- `Tabs`
- `Toast`
- `Skeleton`
- `ErrorState`
- `LoadingState`

## 3. 当前视觉问题

### 全局

- 字体栈已设置，中文不会落到明显异常 fallback；但设计系统没有字体大小/行高 token，页面里字号节奏不统一。
- 主色当前为 teal，视觉清爽但更像早期后台，缺少“沉稳企业 SaaS”的品牌层次。
- 圆角 token 只有 4/6/8px，和本次目标的卡片 16px、大容器 20px 不一致。
- `Card` 默认有 shadow，多个后台页面叠加后模板感偏重。后续应优先 border + subtle background。
- 状态提示在页面中重复写 `border-emerald-200 bg-emerald-50` 等 class，没有统一 `Alert` 或 `InlineNotice`。
- 表格样式在多页重复，缺少统一 `Table`，长列没有稳定横向滚动策略。
- 目前没有统一 loading、error、permission denied、not found 页面。
- 页面内存在大量 `rounded-md`、`bg-slate-50`、`text-amber-*` 等直接 class，设计 token 没有充分承载页面语义。

### 表单

- 大部分 label 位于输入框上方，方向正确。
- 输入框高度基本一致，按钮有 40px 和 44px 混用，搜索按钮常用 `h-11`，主按钮默认 `h-10`。
- 页面里仍存在原生 checkbox 和原生 select，如组授权、候选人列表筛选、预约 slot 勾选。
- 表单错误多为临时 red box，缺少字段级错误、错误图标、统一 spacing。
- server action 表单多数没有 `SubmitButton`，提交时没有统一 pending 防重复和成功反馈。
- `CandidateAdminNoteEditor` 只有保存按钮，没有保存中、保存成功、保存失败反馈。

### 候选人端

- `/join` 基线干净，但缺少副标题和底部隐私提示，和目标文案不完整。
- 候选人时间页在桌面和手机均可用，但布局仍是通用卡片拼接：
  - 时间格不是统一 `CandidateTimeGrid`，只是按日期分组的 button grid。
  - 没有 sticky 提交栏。
  - 已选数量提示位置不够突出。
  - 修改机制提醒存在，但文案和确认体验需要统一。
  - 不可选状态只显示“不可选”，隐私正确，但 disabled/selected/hover 状态还需要更细。
- 移动端没有横向炸裂，但字体和卡片尺度偏大，首屏信息密度不够好。
- 候选人已提交、修改、预约状态共用同一路由，页面分支较长，不利于维护和一致 polish。

### 管理员端

- `AdminShell` 信息架构初步可用，但 sidebar 中“审核中心”“预约管理”仍是占位 span，容易被误认为不可用功能。
- `/admin` 缺少顶部统计或 summary，面试组列表是基础 table，空状态可用但视觉普通。
- `/admin/groups/[id]/settings` 内容完整但分区不够明确，基础信息、候选人说明、时间规则、候选人入口、授权混在一个长页面里。
- `/admin/groups/[id]/slots` 是表格列表，不是管理员时间格；锁定原因直接进表格，复杂时会挤爆。
- `/admin/groups/[id]/candidates` 信息密度合适，但按钮和 select 使用原生样式，缺少行 hover、筛选状态、备注状态的统一语义。
- `/admin/groups/[id]/candidates/[candidateId]` 私有备注标注清楚，这是当前最佳模块之一；但保存状态缺失，安排面试 slot 仍是原生 checkbox 列表。
- `/admin/groups/[id]/reviews/[submissionId]` 新旧版本对比方向正确，但 removed 逻辑目前在只遍历新 slot 时不会真正显示移除项；后续 UI 重构需要连同展示逻辑修复。
- `/admin/groups/[id]/overview` 当前是卡片网格，不是核心工作台式时间总览；没有点击 slot 的详情侧栏，候选人列表展示在卡片里，信息密度和可操作性不足。
- `/admin/groups/[id]/appointments` 表格列较多，内部备注直接铺在表格列，窄屏可读性弱。
- `/admin/audit` 已有横向滚动表格，但整体还是通用 table，和其他后台页面的表格系统未统一。

## 4. 隐私 UI 风险

### 当前正向结果

- 候选人端不渲染其他候选人姓名、邮箱、备注或可用人数。
- 候选人端不可选时间只显示“不可选”，不显示“已预约给谁”“管理员关闭”“锁定原因”。
- 候选人端预约卡只展示 `meetingLocation` 和 `candidateVisibleMessage`，不展示 `Appointment.internalNote`。
- `CandidateAdminNote` 只在管理员候选人详情页和管理员列表状态中出现。
- `tests/unit/candidate-dto.test.ts` 已断言 DTO 不包含 `adminNotes`。
- `tests/e2e/business-flow.spec.ts` 已断言候选人端不出现内部备注、管理员私有备注、锁定原因和其他候选人姓名。

### 需要重点修复或加固

- 候选人页面 `src/app/candidate/[groupCode]/page.tsx` 查询 `timeSlots.activeLock.id` 用于 disabled 判断。当前没有把 `reasonInternal` 传给客户端组件，风险可控；后续应通过明确的 candidate DTO 把 slot 状态压成 `disabled: boolean`，让候选人组件完全不知道 lock 概念。
- `src/lib/candidate/dto.ts` 的单测只显式检查了 `adminNotes`，虽然 `candidateResponseContainsSensitiveField` 覆盖多个 key，但应补直接断言：
  - `internalNote`
  - `reasonInternal`
  - `availableCandidateCount`
  - `otherCandidates`
- `CandidateAdminNoteEditor` 应独立成管理员组件，props 命名带 admin-only 语义，避免未来误传给候选人组件。
- 管理员端展示 `internalNote`、`reasonInternal` 是允许的，但必须视觉上标注 admin-only 或放入详情区域，不应与候选人可见信息混排。
- 全局搜索结果显示 `internalNote`、`reasonInternal`、`adminNotes` 没有出现在候选人组件中，但后续重构必须继续用 auth-security-guard 检查。

## 5. 截图问题

已运行 demo seed 和当前截图脚本：

```bash
pnpm db:seed:demo
PLAYWRIGHT_ADMIN_EMAIL='admin@example.com' \
PLAYWRIGHT_ADMIN_PASSWORD='<LOCAL_DEMO_PASSWORD>' \
PLAYWRIGHT_GROUP_ID='<groupId>' \
PLAYWRIGHT_GROUP_CODE='<groupCode>' \
PLAYWRIGHT_CANDIDATE_ID='<candidateId>' \
PLAYWRIGHT_SUBMISSION_ID='<submissionId>' \
bash scripts/ui-snapshots.sh
```

截图基线保存于：

- `artifacts/ui-snapshots/join.png`
- `artifacts/ui-snapshots/admin-login.png`
- `artifacts/ui-snapshots/admin-dashboard.png`
- `artifacts/ui-snapshots/group-settings.png`
- `artifacts/ui-snapshots/group-slots.png`
- `artifacts/ui-snapshots/candidate-list.png`
- `artifacts/ui-snapshots/candidate-detail.png`
- `artifacts/ui-snapshots/review-detail.png`
- `artifacts/ui-snapshots/review-list.png`
- `artifacts/ui-snapshots/time-overview.png`
- `artifacts/ui-snapshots/appointments.png`
- `artifacts/ui-snapshots/candidate-submit.png`
- `artifacts/ui-snapshots/candidate-submitted.png`
- `artifacts/ui-snapshots/candidate-modification.png`

额外手工 Playwright 手机视口截图：

- `artifacts/ui-snapshots/mobile-join-audit.png`
- `artifacts/ui-snapshots/mobile-candidate-submit-audit.png`

当前截图脚本不足：

- 输出目录不是本次要求的 `artifacts/ui-snapshots/frontend-refactor-p0/`。
- 缺少明确命名的候选人审核中状态页截图。
- 缺少明确命名的候选人面试安排页截图。
- 没有移动端截图集。
- 没有截图后的自动视觉红线检查，只能人工看图。

## 6. 页面重构优先级

P0 稳定优先，建议按风险从低到高推进：

1. 基础设计系统和组件，不触碰业务逻辑。
2. `/join` 和 `/admin/login`，低业务风险，最能建立视觉基调。
3. 候选人时间选择/已提交/修改/预约状态，隐私要求最高，必须先建立 candidate-only DTO 和 `CandidateTimeGrid`。
4. 管理员候选人详情和 `CandidateAdminNoteEditor`，确保 admin-only 信息边界清楚。
5. 管理员列表页和表格系统：dashboard、candidate list、reviews、appointments、audit。
6. 管理员 slots 和 overview，最后做，因为需要 `AdminTimeGrid` 和详情面板，交互最复杂。

## 7. 组件重构计划

### 第一批：设计系统基础

- 扩展 CSS variables 和 Tailwind token：
  - foreground/background/surface/subtle/border/ring。
  - semantic success/warning/danger/info/locked/pending/scheduled。
  - radius 8/12/16/20。
  - shadow 只保留 subtle、floating。
- 新建统一组件：
  - `FormField`
  - `InlineNotice`
  - `StatusBadge`
  - `Table`
  - `Checkbox`
  - `LoadingState`
  - `ErrorState`
  - `Skeleton`

### 第二批：布局

- `CenteredCardLayout` 复用 `/join` 和 `/admin/login`。
- `CandidateShell` 统一候选人端背景、container、隐私提示。
- `AdminShell` 拆分为 `AdminSidebar`、`AdminTopbar`、`AdminContent`。
- `PageHeader`、`SectionHeader` 替换各页手写标题区。

### 第三批：时间格

- 定义明确类型：
  - `CandidateSlotView`：只包含 `id`、`dateLabel`、`timeLabel`、`disabled`、`selected`。
  - `AdminSlotView`：可包含 `status`、`lockReasonInternal`、`availableCandidates`、`appointment` 等 admin-only 字段。
- `CandidateTimeGrid` 不接收 `reasonInternal`、`internalNote`、`candidate count`。
- `AdminTimeGrid` 可显示汇总状态，但复杂信息进入 popover/side panel。

### 第四批：业务页面组件

- 候选人：
  - `JoinForm`
  - `CandidateIdentityCard`
  - `CandidateSubmissionForm`
  - `CandidateSubmittedSummary`
  - `CandidateModificationWarning`
  - `CandidateReviewStatus`
  - `CandidateAppointmentCard`
- 管理员：
  - `GroupSettingsForm`
  - `PermissionEditor`
  - `SlotGenerationForm`
  - `CandidateTable`
  - `CandidateAdminNoteEditor`
  - `ReviewComparison`
  - `AppointmentForm`
  - `AppointmentList`

## 8. Step 1 风险清单

- 最大隐私风险不在当前渲染，而在未来重构时把 admin-only slot 或 note 数据传进 candidate 组件。必须通过类型边界阻止。
- 最大 UI 风险是一次性大改所有页面，容易破坏 P0 E2E。后续应每批组件后跑 `pnpm check` 和完整业务 E2E。
- `ReviewComparison` 目前 UI 没有真实展示 removed slot，重构时要修复展示逻辑并补测试。
- `scripts/ui-snapshots.sh` 当前不能满足最终目录和完整页面矩阵，需要后续 Step 10 升级。
- 现有 `.agents/skills/*` 文档是轻量 checklist，后续执行时仍要用实际代码搜索、截图和 E2E 作为硬证据。
