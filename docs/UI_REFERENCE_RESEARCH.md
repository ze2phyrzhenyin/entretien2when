# UI Reference Research

调研日期：2026-07-01。参考公开页面和产品说明，重点转化为本项目的交互原则，而不是复制视觉。

## 1. When2meet

参考：https://www.when2meet.com/

- 值得借鉴的点：用时间格直接表达可用时间，低学习成本，适合多人可用性汇总。
- 不适合本项目的点：旧式视觉、弱品牌感、共享可见性强，不满足候选人互相不可见。
- 对本项目 UI 的启发：保留“拖/点时间格”的直观性，但候选人端只显示自己的选择和不可选状态；管理员端再显示汇总和原因。

## 2. Calendly

参考：https://calendly.com/features

- 值得借鉴的点：单人预约路径清晰，booking link、availability、event type 的概念对用户友好。
- 不适合本项目的点：偏个人/销售预约，不强调候选人修改审核和管理员私有备注。
- 对本项目 UI 的启发：候选人端采用少步骤、大留白、强反馈；每一步只让用户处理当前任务。

## 3. Doodle

参考：https://doodle.com/en/product/polls/

- 值得借鉴的点：发起人给出候选时间，被邀请人选择可用时间，结构清楚。
- 不适合本项目的点：投票/民意属性强，参与者结果共享通常是核心能力，和隐私隔离目标冲突。
- 对本项目 UI 的启发：管理员先定义候选时间范围；候选人端只在这些范围内选择，不允许自造时间。

## 4. Cal.com

参考：https://cal.com/ 和 https://cal.com/blog/a-complete-walkthrough-of-cal-com-s-booking-dashboard-its-key-features

- 值得借鉴的点：现代 SaaS 后台、可配置 event/booking、预约状态分类和团队管理能力。
- 不适合本项目的点：功能面过宽，集成和自动化过多会稀释 P0 的隐私/审核核心。
- 对本项目 UI 的启发：管理员端使用清晰 sidebar、顶部 summary、表格筛选、集中操作按钮。

## 5. Google Calendar Appointment Scheduling

参考：https://support.google.com/calendar/answer/10729749 和 https://support.google.com/calendar/answer/11608416

- 值得借鉴的点：熟悉的日历心智，低干扰 booking page，创建预约日程时先配置时长和可用时间。
- 不适合本项目的点：强绑定 Google Calendar 生态，P0 不做外部日历同步。
- 对本项目 UI 的启发：时间展示应像日历一样可扫描；不要让候选人理解后台 slot/lock/submission 等概念。

## 6. Microsoft Bookings

参考：https://www.microsoft.com/en-us/microsoft-365/business/scheduling-and-booking-app 和 https://learn.microsoft.com/en-us/microsoft-365/bookings/configure-service-availability

- 值得借鉴的点：企业后台、服务可用性配置、通过可预约条件避免 double-booking。
- 不适合本项目的点：服务/员工/资源概念复杂，候选人面试场景不需要完整 Bookings 模型。
- 对本项目 UI 的启发：后台必须明确显示锁定、关闭、预约状态；服务端必须用唯一约束或事务避免重复预约。

## 7. SavvyCal

参考：https://savvycal.com/ 和 https://savvycal.com/meeting-scheduler

- 值得借鉴的点：week view、细腻 spacing、calendar overlay 思路、对预约者体验的重视。
- 不适合本项目的点：overlay 个人日历会引入外部账号和隐私风险，P0 不做。
- 对本项目 UI 的启发：候选人端时间格要有足够点击面积、细腻状态、横向滚动不挤压文字；整体应有克制品牌感。

## 结论

- 保留 When2meet 的时间格直观性，但不能保留旧式视觉。
- 学习 Calendly 的单人预约流程清晰度。
- 学习 Doodle 的“管理员给出候选时间、候选人选择”的结构。
- 学习 Cal.com 的现代 SaaS 后台和可配置性。
- 学习 Google Calendar 的熟悉、低干扰 booking page。
- 学习 Microsoft Bookings 的企业后台和避免 double-booking 思路。
- 学习 SavvyCal 的 week view、细腻 spacing、品牌感和时间选择体验。
- 最终 UI 必须是中文、干净、专业、克制、易懂；不做花哨拟物、廉价渐变、拥挤表单或默认丑组件拼接。
