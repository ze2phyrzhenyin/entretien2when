"use client";

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
          <p className="font-medium">时间显示</p>
          <p className="text-xs leading-5 text-muted-foreground">
            当前按 {timezoneLabel(timezone)} 显示；时间会从系统 UTC 自动换算。
          </p>
        </div>
      </div>
      <Select
        aria-label="切换时间显示时区"
        className="h-9 min-w-[220px]"
        value={selectValue}
        onChange={(event) => update(event.target.value)}
      >
        <option value="group">面试组时区：{timezoneLabel(defaultTimezone)}</option>
        <option value="browser">浏览器时区：{timezoneLabel(browserTimezone)}</option>
        {manualOptions.map((item) => (
          <option key={item} value={`manual:${item}`}>
            手动：{timezoneLabel(item)}
          </option>
        ))}
      </Select>
    </div>
  );
}
