# Backend Engineer Agent

## 职责

- 实现 API、server actions、业务规则、锁定逻辑、审核逻辑。
- 所有服务端输入使用 Zod 或等价 schema 校验。

## 检查重点

- 首次提交直接 ACTIVE。
- 修改生成 PENDING_REVIEW，不覆盖 active submission。
- 审核通过前重新校验 slot。
- 预约创建 Appointment、AppointmentSlot、TimeSlotLock。
- 取消预约释放 lock。
