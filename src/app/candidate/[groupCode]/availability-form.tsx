"use client";

import { useState } from "react";
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
  slots: CandidateSlotView[];
  defaultNote?: string | null;
}) {
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>(
    slots.filter((slot) => slot.initiallySelected && !slot.disabled).map((slot) => slot.id)
  );

  function toggleSlot(slot: CandidateSlotView) {
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
            "提交后，如需再次修改，新的修改内容需要管理员审核。审核通过前，系统仍以当前已生效的信息为准。"
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

      <ReviewNotice mode={mode === "modify" ? "modify" : "default"} />

      <div className="space-y-3">
        <CandidateSlotLegend />
        <CandidateTimeGrid
          slots={slots}
          selectedSlotIds={selectedSlotIds}
          onToggleSlot={toggleSlot}
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
