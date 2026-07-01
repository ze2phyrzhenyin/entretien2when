# ADR 0005：UI Design Direction

日期：2026-07-01

## 状态

Accepted

## 决策

候选人端学习 Calendly / SavvyCal 的清晰流程、留白和细腻时间选择；管理员端学习 Cal.com / Microsoft Bookings 的 SaaS 后台结构和预约状态管理；保留 When2meet 的时间格直观性，但不继承旧式视觉。

## 默认假设

- 中文企业级 SaaS：干净、可信、专业、轻量。
- 不做花哨拟物、廉价渐变、默认丑表单、拥挤布局。
- 时间格最小点击区域 40px 以上。

## 后果

- 涉及 UI 修改必须运行 ui-quality-gate。
- P0 页面都需要 loading、empty、error、success、validation、focus、responsive 行为。
