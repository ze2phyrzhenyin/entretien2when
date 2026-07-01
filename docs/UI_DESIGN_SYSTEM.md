# UI Design System

本设计系统服务于中文版面试时间管理系统。目标不是制造视觉噪音，而是让候选人端可信、清楚、低干扰，让管理员端像专业 SaaS 后台一样稳定、高效、可扫描。

## 设计原则

- 克制：不使用大面积渐变、装饰性图形、重阴影或高饱和背景。
- 清楚：页面层级、表单字段、状态、下一步动作必须一眼可懂。
- 稳定：按钮、输入框、表格、时间格有稳定尺寸，状态变化不造成布局跳动。
- 隐私优先：候选人端只接收并展示候选人可见数据，不能依靠 CSS 隐藏敏感字段。
- 中文优先：文案短、自然、明确，不出现后台术语给候选人。

## 字体

系统字体栈：

```css
Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
"PingFang SC", "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif
```

规则：

- 正文默认 14px，候选人端关键正文可使用 15px。
- 后台表格 13px 到 14px，但不能牺牲可读性。
- 不使用负 letter spacing。
- 不使用 viewport width 缩放字号。
- 中文按钮、表头、badge 不压缩字距。

## 颜色 Token

主体使用中性灰，主色使用沉稳蓝靛。状态色只表达语义。

| Token              | 用途                         |
| ------------------ | ---------------------------- |
| `background`       | 页面浅灰背景                 |
| `foreground`       | 主要文字                     |
| `surface`          | 卡片、表格、弹层             |
| `surface-subtle`   | 弱分区、表头、时间格底       |
| `muted`            | 低强调背景                   |
| `muted-foreground` | 辅助文字                     |
| `border`           | 默认边框                     |
| `primary`          | 主按钮、焦点、候选人已选时间 |
| `primary-soft`     | 主色浅底                     |
| `info`             | 信息提示                     |
| `success`          | 成功、开放、已通过           |
| `warning`          | 待审核、提醒                 |
| `danger`           | 错误、拒绝、取消             |
| `locked`           | 已锁定、不可安排             |
| `scheduled`        | 已预约                       |

禁止：

- 大面积紫蓝渐变。
- 单一色相铺满页面。
- 用彩色 badge 替代信息层级。
- 候选人端用颜色暗示不可选原因。

## 尺寸与间距

| 场景             | Token / 约束                            |
| ---------------- | --------------------------------------- |
| 页面边距         | mobile 16px；desktop 32px               |
| 候选人 container | 720px 到 960px                          |
| 管理员 container | 使用可用宽度，内容最大 1280px 到 1440px |
| 卡片 padding     | compact 16px；default 24px；large 32px  |
| 表单字段间距     | 18px 到 20px                            |
| 输入框高度       | 44px                                    |
| 按钮高度         | sm 36px；default 40px；lg 44px          |
| 表格行高         | 48px 到 56px                            |
| 时间格最小点击区 | 44px，移动端不小于 48px                 |

## 圆角与阴影

| Token             | 用途                     |
| ----------------- | ------------------------ |
| `radius-sm` 6px   | 小 badge、小标签         |
| `radius-md` 8px   | input、button、time cell |
| `radius-lg` 12px  | 表格容器、notice         |
| `radius-xl` 16px  | card                     |
| `radius-2xl` 20px | 候选人端主容器、dialog   |

阴影：

- 默认使用 border + subtle background。
- `shadow-subtle` 只用于卡片轻微脱离背景。
- `shadow-floating` 只用于 popover、dialog、sticky bar。

## 表单

- label 必须在控件上方，placeholder 不替代 label。
- helper text 和 error text 在字段下方。
- 错误态使用统一 `FormField`，不要页面内临时写红框。
- disabled、readonly、loading 要清楚。
- submit 时按钮 disabled，文案固定或宽度固定，避免跳动。
- 成功和失败反馈使用 `InlineNotice` 或 toast。
- checkbox、select 不使用浏览器默认裸样式。

## 按钮

Variant：

- `primary`：主操作。
- `secondary`：次要实体操作。
- `ghost`：低强调操作。
- `danger`：拒绝、取消预约、移除授权。

规则：

- 图标按钮优先使用 lucide 图标。
- 图标按钮必须有 `aria-label`。
- 同一行按钮高度一致。
- loading 不改变按钮高度。

## 状态 Badge

Badge 必须通过统一 `StatusBadge` 映射业务状态，不在页面里手写颜色。

候选人状态：

- 未提交
- 已提交
- 修改待审
- 已预约
- 已取消

提交状态：

- 当前有效
- 待审核
- 已通过
- 已拒绝
- 已替换

时间状态：

- 开放
- 关闭
- 已锁定
- 已预约
- 可用
- 不可选

## 时间格

时间格是本产品核心组件。

### 候选人端

候选人端 `CandidateTimeGrid` 只能接收：

- `id`
- `dateLabel`
- `timeLabel`
- `disabled`
- `selected`

候选人端禁止接收或展示：

- `reasonInternal`
- `internalNote`
- `lockedBy`
- `availableCandidateCount`
- `otherCandidates`
- 其他候选人姓名、邮箱、备注

状态：

- 可选：白底、清晰边框。
- hover：主色浅底或边框增强。
- 已选择：主色填充，带明确 check icon。
- 不可选：中性灰，文案统一“不可选”。

### 管理员端

管理员端 `AdminTimeGrid` 可以接收 admin-only 状态，但复杂信息不直接塞进格子：

- 锁定原因进入 popover、side panel 或详情区域。
- 候选人列表进入详情区域。
- 格子本体显示状态、候选人数、预约/锁定标识。

## 表格

- 使用统一 `Table` 组件。
- 表头背景使用 `surface-subtle`。
- 长表格必须支持横向滚动。
- 管理员表格可以密集，但行内操作不能拥挤。
- 空状态、加载状态、错误状态必须存在。
- 不用原生无样式 table、select、checkbox。

## Notice

使用统一 `InlineNotice`：

- `info`：说明。
- `success`：操作成功。
- `warning`：修改审核、注意事项。
- `danger`：错误、不可继续。
- `admin`：仅管理员可见。
- `privacy`：隐私提示。

## 布局

候选人端：

- 使用 `CandidateShell`。
- 背景浅灰，主内容卡片或分区留白更大。
- 移动端优先；时间格可横向滚动但不能挤压文字。

管理员端：

- 使用 `AdminShell`、`AdminSidebar`、`AdminTopbar`、`AdminContent`。
- 左侧导航稳定，顶部显示当前上下文和账号。
- 页面标题使用 `PageHeader`。
- 组内二级导航使用统一 tabs。

## Empty / Loading / Error

每个核心页面必须具备：

- 空状态：说明为什么为空，给出下一步。
- loading：使用 skeleton，不闪烁布局。
- error：说明发生了什么，提供返回或重试。
- permission denied：不暴露不存在还是无权限的细节。

## 截图验收

最终截图目录：

```text
artifacts/ui-snapshots/frontend-refactor-p0/
```

必须覆盖：

- 候选人端：join、首次提交、已提交、修改申请、审核中、面试安排。
- 管理员端：login、dashboard、settings、slots、candidate list、candidate detail、review detail、overview、appointments。

## 中文文案

候选人端推荐文案：

- 标题：填写面试时间
- 隐私提示：你的信息不会展示给其他候选人。
- 修改提醒：提交后如需修改，新的修改内容需要管理员审核。审核通过前，系统仍以当前已生效的信息为准。
- 修改页提醒：本次修改不会立即生效。提交后将发送给管理员审核，审核通过后才会替换你当前已提交的信息。
- 待审核状态：你的修改申请正在等待管理员审核。审核通过前，当前有效提交不会改变。
- 不可选时间：不可选
- 管理员私有备注：管理员私有备注
- 管理员私有备注说明：仅管理员可见，候选人不会看到这部分内容。
