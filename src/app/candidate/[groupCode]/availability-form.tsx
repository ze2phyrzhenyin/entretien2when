"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  requestSubmissionModificationAction,
  submitInitialAvailabilityAction
} from "@/server/actions/candidate";

type CandidateSlotOption = {
  id: string;
  dateLabel: string;
  timeLabel: string;
  disabled: boolean;
  initiallySelected?: boolean;
};

export function AvailabilityForm({
  mode,
  groupCode,
  name,
  email,
  minSelectSlots,
  maxSelectSlots,
  slots,
  defaultNote
}: {
  mode: "initial" | "modify";
  groupCode: string;
  name: string;
  email: string;
  minSelectSlots: number;
  maxSelectSlots: number;
  slots: CandidateSlotOption[];
  defaultNote?: string | null;
}) {
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>(
    slots.filter((slot) => slot.initiallySelected && !slot.disabled).map((slot) => slot.id)
  );
  const groupedSlots = useMemo(() => {
    const groups = new Map<string, CandidateSlotOption[]>();
    for (const slot of slots) {
      groups.set(slot.dateLabel, [...(groups.get(slot.dateLabel) ?? []), slot]);
    }
    return [...groups.entries()];
  }, [slots]);

  function toggleSlot(slot: CandidateSlotOption) {
    if (slot.disabled) {
      return;
    }

    setSelectedSlotIds((current) => {
      if (current.includes(slot.id)) {
        return current.filter((slotId) => slotId !== slot.id);
      }
      if (current.length >= maxSelectSlots) {
        return current;
      }
      return [...current, slot.id];
    });
  }

  return (
    <form
      action={
        mode === "initial" ? submitInitialAvailabilityAction : requestSubmissionModificationAction
      }
      className="space-y-6"
      onSubmit={(event) => {
        if (mode === "modify") {
          const confirmed = window.confirm(
            "本次修改不会立即生效，需要管理员审核。审核通过前仍以旧版本为准。确认提交修改申请？"
          );
          if (!confirmed) {
            event.preventDefault();
          }
        }
      }}
    >
      <input type="hidden" name="groupCode" value={groupCode} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="slotIds" value={selectedSlotIds.join(",")} />

      <div className="rounded-md border border-teal-100 bg-teal-50 px-3 py-3 text-sm leading-6 text-teal-900">
        {mode === "modify"
          ? "本次修改不会立即生效，需要管理员审核。审核通过前仍以旧版本为准。"
          : "提交后如需修改，需要管理员审核。请尽量选择多个可用时间，方便安排。"}
      </div>

      <div className="space-y-5">
        {groupedSlots.length === 0 ? (
          <div className="rounded-md border border-border bg-slate-50 p-6 text-sm text-muted-foreground">
            当前面试组还没有开放时间，请联系招聘方。
          </div>
        ) : (
          groupedSlots.map(([dateLabel, daySlots]) => (
            <section key={dateLabel} className="space-y-3">
              <h3 className="text-sm font-semibold">{dateLabel}</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {daySlots.map((slot) => {
                  const selected = selectedSlotIds.includes(slot.id);

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={slot.disabled}
                      onClick={() => toggleSlot(slot)}
                      className={cn(
                        "flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-white text-slate-800 hover:border-teal-300 hover:bg-teal-50",
                        slot.disabled &&
                          "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 hover:border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      {selected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                      {slot.disabled ? "不可选" : slot.timeLabel}
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      <div className="flex flex-col justify-between gap-2 rounded-md border border-border bg-white p-3 text-sm sm:flex-row sm:items-center">
        <span className="text-muted-foreground">
          已选择 {selectedSlotIds.length} 个，最少 {minSelectSlots} 个，最多 {maxSelectSlots} 个
        </span>
        {selectedSlotIds.length >= maxSelectSlots ? (
          <span className="font-medium text-amber-700">已达到最多可选数量</span>
        ) : null}
      </div>

      <div>
        <label
          className="block text-sm font-medium leading-6 text-slate-800"
          htmlFor="candidateNote"
        >
          备注
        </label>
        <Textarea
          id="candidateNote"
          name="candidateNote"
          defaultValue={defaultNote ?? ""}
          placeholder="可填写时间偏好、面试方式限制等。"
        />
      </div>

      {mode === "modify" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-900">
          提交按钮会再次确认：修改需要管理员审核，审核通过后才会生效。
        </div>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        disabled={
          selectedSlotIds.length < minSelectSlots || selectedSlotIds.length > maxSelectSlots
        }
      >
        {mode === "modify" ? "提交修改申请" : "提交可用时间"}
      </Button>
    </form>
  );
}
