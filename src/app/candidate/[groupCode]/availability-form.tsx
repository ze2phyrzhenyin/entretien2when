"use client";
import { useLocale } from "@/i18n/locale-provider";
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
  const { t } = useLocale();
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
            t(
              "legacy.after_submission_if_you_need_to_modify_it_again_the_new_modification_con.2966d4e5"
            )
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

      <FormField id="candidateNote" label={t("legacy.notes.daede988")}>
        <Textarea
          id="candidateNote"
          name="candidateNote"
          defaultValue={defaultNote ?? ""}
          placeholder={t(
            "legacy.you_can_fill_in_time_preference_interview_method_restrictions_etc.6ac47e1d"
          )}
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
        {mode === "modify"
          ? t("legacy.submit_modification_request.4200a9db")
          : t("legacy.submit_availability.112035c7")}
      </Button>
    </form>
  );
}
