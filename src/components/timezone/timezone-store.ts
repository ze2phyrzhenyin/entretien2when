"use client";

import { commonTimezones, DEFAULT_TIMEZONE, isValidTimezone } from "@/lib/date/timezone";

export const TIMEZONE_MODE_STORAGE_KEY = "interviewScheduler.timezoneMode";
export const TIMEZONE_MANUAL_STORAGE_KEY = "interviewScheduler.manualTimezone";
export const TIMEZONE_CHANGE_EVENT = "interviewScheduler:timezone-change";

export type TimezoneMode = "group" | "browser" | "manual";

export type TimezonePreference = {
  mode: TimezoneMode;
  manualTimezone: string;
};

export function getBrowserTimezone() {
  if (typeof window === "undefined") {
    return DEFAULT_TIMEZONE;
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timezone && isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
}

export function readTimezonePreference(): TimezonePreference {
  if (typeof window === "undefined") {
    return {
      mode: "group",
      manualTimezone: DEFAULT_TIMEZONE
    };
  }

  const mode = window.localStorage.getItem(TIMEZONE_MODE_STORAGE_KEY);
  const manualTimezone =
    window.localStorage.getItem(TIMEZONE_MANUAL_STORAGE_KEY) ?? DEFAULT_TIMEZONE;

  return {
    mode: mode === "browser" || mode === "manual" ? mode : "group",
    manualTimezone: isValidTimezone(manualTimezone) ? manualTimezone : DEFAULT_TIMEZONE
  };
}

export function writeTimezonePreference(preference: TimezonePreference) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(TIMEZONE_MODE_STORAGE_KEY, preference.mode);
  window.localStorage.setItem(TIMEZONE_MANUAL_STORAGE_KEY, preference.manualTimezone);
  window.dispatchEvent(new Event(TIMEZONE_CHANGE_EVENT));
}

export function resolveDisplayTimezone(defaultTimezone: string, preference: TimezonePreference) {
  if (preference.mode === "browser") {
    return getBrowserTimezone();
  }
  if (preference.mode === "manual" && isValidTimezone(preference.manualTimezone)) {
    return preference.manualTimezone;
  }
  return isValidTimezone(defaultTimezone) ? defaultTimezone : DEFAULT_TIMEZONE;
}

export function timezoneLabel(timezone: string) {
  return commonTimezones.find((item) => item.value === timezone)?.label ?? timezone;
}
