ALTER TABLE "InterviewGroup"
  DROP CONSTRAINT IF EXISTS "InterviewGroup_duration_rules_check";

UPDATE "InterviewGroup"
SET "slotDurationMinutes" = 1
WHERE "slotDurationMinutes" < 1;

UPDATE "InterviewGroup"
SET "interviewDurationMinutes" = 1
WHERE "interviewDurationMinutes" < 1;

UPDATE "InterviewGroup"
SET "slotDurationMinutes" = "interviewDurationMinutes" + 1
WHERE "interviewDurationMinutes" >= "slotDurationMinutes";

ALTER TABLE "InterviewGroup"
  ADD CONSTRAINT "InterviewGroup_duration_rules_check"
  CHECK (
    "slotDurationMinutes" > 0
    AND "interviewDurationMinutes" > 0
    AND "interviewDurationMinutes" < "slotDurationMinutes"
  );
