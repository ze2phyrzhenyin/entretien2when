"use client";

import { useEffect, useMemo, useState } from "react";
import {
  readTimezonePreference,
  resolveDisplayTimezone,
  TIMEZONE_CHANGE_EVENT,
  type TimezonePreference
} from "@/components/timezone/timezone-store";

export function useDisplayTimezone(defaultTimezone: string) {
  const [preference, setPreference] = useState<TimezonePreference>(() => ({
    mode: "group",
    manualTimezone: defaultTimezone
  }));

  useEffect(() => {
    const refresh = () => setPreference(readTimezonePreference());
    refresh();

    window.addEventListener(TIMEZONE_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(TIMEZONE_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return useMemo(
    () => ({
      preference,
      timezone: resolveDisplayTimezone(defaultTimezone, preference)
    }),
    [defaultTimezone, preference]
  );
}
