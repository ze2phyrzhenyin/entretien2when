"use client";

import { useEffect, useState } from "react";
import { FormField } from "@/components/design-system/form-field";
import { ReviewNotice } from "@/components/design-system/review-notice";
import { CandidateTimeGrid } from "@/components/scheduling/candidate-time-grid";
import { CandidateSlotLegend } from "@/components/scheduling/slot-legend";
import { SelectedSlotsSummary } from "@/components/scheduling/selected-slots-summary";
import type { CandidateSlotView } from "@/components/scheduling/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  requestSubmissionModificationAction,
  submitInitialAvailabilityAction
} from "@/server/actions/candidate";

export function AvailabilityForm({
  mode,
  groupCode,
  defaultTimezone,
  minSelectSlots,
  maxSelectSlots,
  slots,
  defaultNote
}: {
  mode: "initial" | "modify";
  groupCode: string;
  defaultTimezone: string;
  minSelectSlots: number;
  maxSelectSlots: number;
  slots: CandidateSlotView[];
  defaultNote?: string | null;
}) {
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>(
    slots.filter((slot) => slot.initiallySelected && !slot.disabled).map((slot) => slot.id)
  );
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeStart, setRangeStart] = useState<{
    slotId: string;
    daySlotIds: string[];
  } | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  function selectSlots(targetSlots: CandidateSlotView[]) {
    setSelectedSlotIds((current) => {
      const next = [...current];
      for (const slot of targetSlots) {
        if (slot.disabled || next.includes(slot.id) || next.length >= maxSelectSlots) {
          continue;
        }
        next.push(slot.id);
      }
      return next;
    });
  }

  function clearSlots(targetSlots: CandidateSlotView[]) {
    const targetSlotIds = new Set(targetSlots.map((slot) => slot.id));
    setSelectedSlotIds((current) => current.filter((slotId) => !targetSlotIds.has(slotId)));
    if (rangeStart && targetSlotIds.has(rangeStart.slotId)) {
      setRangeStart(null);
    }
  }

  function toggleSlot(slot: CandidateSlotView, daySlots: CandidateSlotView[]) {
    if (slot.disabled) {
      return;
    }

    if (rangeMode) {
      if (!rangeStart || !rangeStart.daySlotIds.includes(slot.id)) {
        setRangeStart({ slotId: slot.id, daySlotIds: daySlots.map((daySlot) => daySlot.id) });
        selectSlots([slot]);
        return;
      }

      const startIndex = daySlots.findIndex((daySlot) => daySlot.id === rangeStart.slotId);
      const endIndex = daySlots.findIndex((daySlot) => daySlot.id === slot.id);
      if (startIndex >= 0 && endIndex >= 0) {
        const from = Math.min(startIndex, endIndex);
        const to = Math.max(startIndex, endIndex);
        selectSlots(daySlots.slice(from, to + 1));
      }
      setRangeStart(null);
      setRangeMode(false);
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
            "提交后，如需再次修改，新的修改内容需要管理员审核。审核通过前，系统仍以当前已生效的信息为准。"
          );
          if (!confirmed) {
            event.preventDefault();
          }
        }
      }}
    >
      <input type="hidden" name="groupCode" value={groupCode} />
      <input type="hidden" name="slotIds" value={selectedSlotIds.join(",")} />
      {hydrated ? <span data-testid="availability-ready" className="sr-only" /> : null}

      <ReviewNotice mode={mode === "modify" ? "modify" : "default"} />

      <div className="space-y-3">
        <CandidateSlotLegend />
        <CandidateTimeGrid
          slots={slots}
          defaultTimezone={defaultTimezone}
          selectedSlotIds={selectedSlotIds}
          maxSelectSlots={maxSelectSlots}
          rangeMode={rangeMode}
          rangeStartSlotId={rangeStart?.slotId ?? null}
          onToggleRangeMode={() => {
            setRangeMode((current) => !current);
            setRangeStart(null);
          }}
          onToggleSlot={toggleSlot}
          onSelectSlots={selectSlots}
          onClearSlots={clearSlots}
        />
      </div>

      <SelectedSlotsSummary
        selectedCount={selectedSlotIds.length}
        minSelectSlots={minSelectSlots}
        maxSelectSlots={maxSelectSlots}
      />

      <FormField id="candidateNote" label="备注">
        <Textarea
          id="candidateNote"
          name="candidateNote"
          defaultValue={defaultNote ?? ""}
          placeholder="可填写时间偏好、面试方式限制等。"
        />
      </FormField>

      {mode === "modify" ? <ReviewNotice mode="modify" /> : null}

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
