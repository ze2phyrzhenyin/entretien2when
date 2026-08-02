"use client";
import { useLocale } from "@/i18n/locale-provider";
import { Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Select } from "@/components/ui/select";
import { commonTimezones, DEFAULT_TIMEZONE, isValidTimezone } from "@/lib/date/timezone";
import {
  getBrowserTimezone,
  readTimezonePreference,
  timezoneLabel,
  writeTimezonePreference,
  type TimezoneMode
} from "@/components/timezone/timezone-store";
import { useDisplayTimezone } from "@/components/timezone/use-display-timezone";
export function TimezoneSwitcher({ defaultTimezone }: { defaultTimezone: string }) {
  const { t } = useLocale();
  const { preference, timezone } = useDisplayTimezone(defaultTimezone);
  const [browserTimezone, setBrowserTimezone] = useState(DEFAULT_TIMEZONE);
  useEffect(() => {
    setBrowserTimezone(getBrowserTimezone());
  }, []);
  const manualOptions = useMemo(() => {
    const values = new Set<string>(commonTimezones.map((item) => item.value));
    values.add(defaultTimezone);
    values.add(browserTimezone);
    return [...values].filter(isValidTimezone);
  }, [browserTimezone, defaultTimezone]);
  const selectValue =
    preference.mode === "group" || preference.mode === "browser"
      ? preference.mode
      : `manual:${timezone}`;
  function update(value: string) {
    if (value === "group" || value === "browser") {
      writeTimezonePreference({
        ...readTimezonePreference(),
        mode: value as TimezoneMode
      });
      return;
    }
    const manualTimezone = value.replace(/^manual:/, "");
    writeTimezonePreference({
      mode: "manual",
      manualTimezone
    });
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <Clock className="mt-0.5 size-4 text-primary" aria-hidden="true" />
        <div>
          <p className="font-medium">{t("legacy.time_display.f7713615")}</p>
          <p className="text-xs leading-5 text-muted-foreground">
            {t("timezone.currentSummary", { timezone: timezoneLabel(timezone) })}
          </p>
        </div>
      </div>
      <Select
        aria-label={t("legacy.switch_time_display_time_zone.09ec84b0")}
        className="h-9 min-w-[220px]"
        value={selectValue}
        onChange={(event) => update(event.target.value)}
      >
        <option value="group">
          {t("timezone.option.group", { timezone: timezoneLabel(defaultTimezone) })}
        </option>
        <option value="browser">
          {t("timezone.option.browser", { timezone: timezoneLabel(browserTimezone) })}
        </option>
        {manualOptions.map((item) => (
          <option key={item} value={`manual:${item}`}>
            {t("timezone.option.manual", { timezone: timezoneLabel(item) })}
          </option>
        ))}
      </Select>
    </div>
  );
}
