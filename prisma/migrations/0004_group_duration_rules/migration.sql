UPDATE "InterviewGroup"
SET "slotDurationMinutes" = LEAST(180, GREATEST(10, (("slotDurationMinutes" + 4) / 5) * 5))
WHERE "slotDurationMinutes" < 10
  OR "slotDurationMinutes" > 180
  OR "slotDurationMinutes" % 5 <> 0;

UPDATE "InterviewGroup"
SET "interviewDurationMinutes" = LEAST(175, GREATEST(5, (("interviewDurationMinutes" + 4) / 5) * 5))
WHERE "interviewDurationMinutes" < 5
  OR "interviewDurationMinutes" > 175
  OR "interviewDurationMinutes" % 5 <> 0;

UPDATE "InterviewGroup"
SET "interviewDurationMinutes" = GREATEST(5, "slotDurationMinutes" - 5)
WHERE "interviewDurationMinutes" >= "slotDurationMinutes";

ALTER TABLE "InterviewGroup"
  ALTER COLUMN "slotDurationMinutes" SET DEFAULT 60,
  ALTER COLUMN "interviewDurationMinutes" SET DEFAULT 30;

ALTER TABLE "InterviewGroup"
  ADD CONSTRAINT "InterviewGroup_duration_rules_check"
  CHECK (
    "slotDurationMinutes" BETWEEN 10 AND 180
    AND "slotDurationMinutes" % 5 = 0
    AND "interviewDurationMinutes" BETWEEN 5 AND 175
    AND "interviewDurationMinutes" % 5 = 0
    AND "interviewDurationMinutes" < "slotDurationMinutes"
  );
