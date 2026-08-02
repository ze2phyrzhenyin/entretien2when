import { describe, expect, it, vi } from "vitest";
import { persistLocaleWithRetry } from "@/i18n/locale-persistence";

describe("locale persistence", () => {
  it("retries transient failures and sends the candidate group scope", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });
    const wait = vi.fn().mockResolvedValue(undefined);

    await persistLocaleWithRetry({
      url: "/api/locale",
      locale: "en",
      groupCode: "GROUP-CODE",
      fetcher,
      wait
    });

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetcher.mock.calls[0]![1].body as string)).toEqual({
      locale: "en",
      groupCode: "GROUP-CODE"
    });
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it("reports a durable failure after all retries are exhausted", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false });

    await expect(
      persistLocaleWithRetry({
        url: "/api/locale",
        locale: "zh-CN",
        groupCode: "GROUP-CODE",
        fetcher,
        wait: async () => undefined
      })
    ).rejects.toThrow("Locale persistence failed");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
