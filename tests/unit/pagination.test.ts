import { describe, expect, it } from "vitest";
import { buildPaginationHref, createPagination, parsePageParam } from "@/lib/pagination";

describe("pagination helpers", () => {
  it("accepts only positive integer page values and bounds the requested page", () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("2foo")).toBe(1);
    expect(parsePageParam("12", 5)).toBe(5);
  });

  it("clamps an out-of-range page after the total is known", () => {
    expect(createPagination({ page: "9", pageSize: 50, totalCount: 51 })).toEqual({
      page: 2,
      pageSize: 50,
      pageCount: 2,
      totalCount: 51,
      skip: 50
    });
  });

  it("preserves filters while resetting page one to the canonical URL", () => {
    expect(buildPaginationHref("/admin/appointments", { q: "张 三", status: "SCHEDULED" }, 2)).toBe(
      "/admin/appointments?page=2&q=%E5%BC%A0+%E4%B8%89&status=SCHEDULED"
    );
    expect(buildPaginationHref("/admin/appointments", { q: "张 三", page: "2" }, 1)).toBe(
      "/admin/appointments?q=%E5%BC%A0+%E4%B8%89"
    );
  });
});
