# UI Design System

## 品牌气质

中文企业级 SaaS，干净、可信、专业、轻量。候选人端低干扰，管理员端信息密度可接受但不拥挤。

## 字体

优先使用 system font。字体栈：

```css
Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
"PingFang SC", "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif
```

不允许中文显示异常，不使用负 letter spacing，不按 viewport 缩放字号。

## 颜色

- 中性底色：`slate-50` / 白色卡片 / `border`。
- 主色：克制 teal，用于主按钮、focus、已选择时间格。
- 状态色：success、danger、warning 只表达语义，不做装饰色。
- 禁止廉价大面积渐变、单一色相堆叠、过重阴影。

## 间距与尺寸

- 页面 padding：移动端 16px，桌面端 32px。
- 卡片 padding：24px，复杂表单 32px。
- 表单字段间距：20px。
- 输入框高度：44px。
- 按钮高度：40px，按钮 loading 不得造成宽高跳动。
- 时间格最小点击区域：40px 以上。

## 圆角与阴影

- 圆角 token：4px / 6px / 8px。
- 卡片最大 8px 圆角。
- 阴影轻微，仅用于明确层级，不做模板站效果。

## 表单

- label 永远在输入框上方，placeholder 不能代替 label。
- 错误文案在字段下方。
- 输入框高度一致。
- textarea 最小高度固定。
- disabled 状态必须清楚。
- 成功、错误、loading 都要有明确反馈。

## 按钮

- primary：主操作。
- secondary：次要实体操作。
- ghost：低强调操作。
- danger：删除、拒绝、取消等风险操作。
- 图标按钮使用 lucide 图标，并提供可访问名称。

## 时间格

- 普通可选：浅色边框，hover 有反馈。
- 已选择：主色填充或主色边框 + 勾选。
- 不可选：浅灰，不可点击。
- locked：候选人端统一显示不可选，不展示原因。
- admin-only states：管理员端显示锁图标、锁定原因、关闭状态。
- 管理员端和候选人端必须使用不同 DTO，不允许仅靠 CSS 隐藏敏感字段。

## 表格

后台表格必须有搜索、筛选、空状态、loading、错误状态。表头清楚，sticky header 用于长表格，间距足够，不使用浏览器默认 table 样式。

## 空状态

每个核心页面都有空状态，说明当前为什么为空，并给出下一步操作。

## 响应式

- 候选人端必须适配手机。
- 管理员后台至少在桌面和平板可用。
- 时间格移动端可横向滚动，但不能挤压文字或产生不可控溢出。

## 无障碍

颜色对比达标；键盘 focus 明显；表单错误可读；按钮和图标有可访问名称。

## 中文文案

简洁、明确，不使用机器翻译腔。候选人端避免后台术语，如 submission、slot、lock、DTO。
