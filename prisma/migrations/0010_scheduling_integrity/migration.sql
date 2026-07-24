-- Scheduling is a data-integrity boundary. Historical slots are retained for
-- audit and may be referenced by submissions or appointments, so never delete
-- or rewrite them during this migration. A past OPEN slot cannot be selected
-- any more; close stale members of an overlap instead. Current or future OPEN
-- overlaps remain an explicit release blocker rather than being guessed away.
UPDATE "GroupTimeSlot" AS stale_slot
SET "status" = 'CLOSED'
WHERE stale_slot."status" = 'OPEN'
  AND stale_slot."endAt" < CURRENT_TIMESTAMP
  AND EXISTS (
    SELECT 1
    FROM "GroupTimeSlot" AS other_slot
    WHERE other_slot."groupId" = stale_slot."groupId"
      AND other_slot."id" <> stale_slot."id"
      AND other_slot."status" = 'OPEN'
      AND stale_slot."startAt" < other_slot."endAt"
      AND stale_slot."endAt" > other_slot."startAt"
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "GroupTimeSlot"
    WHERE "endAt" <= "startAt"
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Cannot add scheduling integrity constraints: GroupTimeSlot contains a non-positive interval.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "GroupTimeSlot" AS left_slot
    JOIN "GroupTimeSlot" AS right_slot
      ON left_slot."groupId" = right_slot."groupId"
      AND left_slot."id" < right_slot."id"
      AND left_slot."startAt" < right_slot."endAt"
      AND left_slot."endAt" > right_slot."startAt"
    WHERE left_slot."status" = 'OPEN'
      AND right_slot."status" = 'OPEN'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = 'Cannot add scheduling integrity constraints: GroupTimeSlot contains overlapping OPEN intervals.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Appointment"
    WHERE "endAt" <= "startAt"
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Cannot add scheduling integrity constraints: Appointment contains a non-positive interval.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Appointment"
    WHERE "status" = 'SCHEDULED'
    GROUP BY "candidateId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Cannot add scheduling integrity constraints: a candidate has more than one scheduled appointment.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "AppointmentInterviewer" AS left_assignment
    JOIN "Appointment" AS left_appointment
      ON left_appointment."id" = left_assignment."appointmentId"
    JOIN "AppointmentInterviewer" AS right_assignment
      ON right_assignment."interviewerId" = left_assignment."interviewerId"
    JOIN "Appointment" AS right_appointment
      ON right_appointment."id" = right_assignment."appointmentId"
    WHERE left_appointment."status" = 'SCHEDULED'
      AND right_appointment."status" = 'SCHEDULED'
      AND left_appointment."id" < right_appointment."id"
      AND left_appointment."startAt" < right_appointment."endAt"
      AND left_appointment."endAt" > right_appointment."startAt"
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = 'Cannot add scheduling integrity constraints: an interviewer has overlapping scheduled appointments.';
  END IF;
END
$$;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "GroupTimeSlot"
  ADD CONSTRAINT "GroupTimeSlot_end_after_start_check"
  CHECK ("endAt" > "startAt");

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_end_after_start_check"
  CHECK ("endAt" > "startAt");

-- Adjacent [start, end) intervals are valid. Any partial or full overlap among
-- selectable slots is rejected even when the write bypasses application code.
-- CLOSED historical slots are intentionally excluded: they are immutable audit
-- references and cannot be re-opened into an overlapping interval.
ALTER TABLE "GroupTimeSlot"
  ADD CONSTRAINT "GroupTimeSlot_no_overlap"
  EXCLUDE USING gist (
    "groupId" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
  ) WHERE ("status" = 'OPEN');

-- Candidate records are group-scoped, so one SCHEDULED appointment per
-- candidate is the stronger form of the per-candidate/per-round invariant.
CREATE UNIQUE INDEX "Appointment_single_scheduled_candidate_key"
  ON "Appointment" ("candidateId")
  WHERE "status" = 'SCHEDULED';

-- A cross-table exclusion constraint is not available for an interviewer
-- assignment, so enforce it in PostgreSQL triggers. Each trigger acquires the
-- same transaction-scoped advisory key as application writes, then checks the
-- current appointment interval before the relation is persisted or changed.
CREATE OR REPLACE FUNCTION "guard_appointment_interviewer_overlap"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_start TIMESTAMP(3);
  target_end TIMESTAMP(3);
  target_status "AppointmentStatus";
BEGIN
  SELECT "startAt", "endAt", "status"
    INTO target_start, target_end, target_status
  FROM "Appointment"
  WHERE "id" = NEW."appointmentId";

  IF NOT FOUND OR target_status <> 'SCHEDULED' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('when2entretien:state'),
    hashtext('interviewer:' || NEW."interviewerId")
  );

  IF EXISTS (
    SELECT 1
    FROM "AppointmentInterviewer" AS other_assignment
    JOIN "Appointment" AS other_appointment
      ON other_appointment."id" = other_assignment."appointmentId"
    WHERE other_assignment."interviewerId" = NEW."interviewerId"
      AND other_assignment."id" <> NEW."id"
      AND other_appointment."status" = 'SCHEDULED'
      AND other_appointment."startAt" < target_end
      AND other_appointment."endAt" > target_start
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      CONSTRAINT = 'AppointmentInterviewer_no_overlap',
      MESSAGE = 'An interviewer cannot be assigned to overlapping scheduled appointments.';
  END IF;

  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION "guard_appointment_interviewer_interval"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  assignment RECORD;
BEGIN
  IF NEW."status" <> 'SCHEDULED' THEN
    RETURN NEW;
  END IF;

  FOR assignment IN
    SELECT "interviewerId"
    FROM "AppointmentInterviewer"
    WHERE "appointmentId" = NEW."id"
    ORDER BY "interviewerId"
  LOOP
    PERFORM pg_advisory_xact_lock(
      hashtext('when2entretien:state'),
      hashtext('interviewer:' || assignment."interviewerId")
    );
  END LOOP;

  FOR assignment IN
    SELECT "interviewerId"
    FROM "AppointmentInterviewer"
    WHERE "appointmentId" = NEW."id"
    ORDER BY "interviewerId"
  LOOP
    IF EXISTS (
      SELECT 1
      FROM "AppointmentInterviewer" AS other_assignment
      JOIN "Appointment" AS other_appointment
        ON other_appointment."id" = other_assignment."appointmentId"
      WHERE other_assignment."interviewerId" = assignment."interviewerId"
        AND other_assignment."appointmentId" <> NEW."id"
        AND other_appointment."status" = 'SCHEDULED'
        AND other_appointment."startAt" < NEW."endAt"
        AND other_appointment."endAt" > NEW."startAt"
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23P01',
        CONSTRAINT = 'AppointmentInterviewer_no_overlap',
        MESSAGE = 'An interviewer cannot be assigned to overlapping scheduled appointments.';
    END IF;
  END LOOP;

  RETURN NEW;
END
$$;

CREATE TRIGGER "AppointmentInterviewer_overlap_guard"
  BEFORE INSERT OR UPDATE OF "appointmentId", "interviewerId"
  ON "AppointmentInterviewer"
  FOR EACH ROW
  EXECUTE FUNCTION "guard_appointment_interviewer_overlap"();

CREATE TRIGGER "Appointment_interviewer_interval_guard"
  BEFORE UPDATE OF "startAt", "endAt", "status"
  ON "Appointment"
  FOR EACH ROW
  EXECUTE FUNCTION "guard_appointment_interviewer_interval"();
