import Link from "next/link";
import { buildPaginationHref, type Pagination } from "@/lib/pagination";

type PaginationNavProps = Pagination & {
  pathname: string;
  searchParams: Record<string, string | undefined>;
  itemLabel?: string;
};

export function PaginationNav({
  pathname,
  searchParams,
  page,
  pageCount,
  pageSize,
  totalCount,
  itemLabel = "条记录"
}: PaginationNavProps) {
  if (totalCount === 0) {
    return null;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);
  const previousHref = buildPaginationHref(pathname, searchParams, page - 1);
  const nextHref = buildPaginationHref(pathname, searchParams, page + 1);

  return (
    <nav
      aria-label={`${itemLabel}分页`}
      className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-surface-subtle px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-muted-foreground" aria-live="polite">
        显示 {start}–{end}，共 {totalCount} {itemLabel} · 第 {page} / {pageCount} 页
      </p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link
              href={previousHref}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              上一页
            </Link>
          ) : (
            <span
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-muted px-3 text-xs font-medium text-muted-foreground"
              aria-disabled="true"
            >
              上一页
            </span>
          )}
          <span className="min-w-20 text-center text-xs font-medium" aria-current="page">
            {page} / {pageCount}
          </span>
          {page < pageCount ? (
            <Link
              href={nextHref}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              下一页
            </Link>
          ) : (
            <span
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-muted px-3 text-xs font-medium text-muted-foreground"
              aria-disabled="true"
            >
              下一页
            </span>
          )}
        </div>
      ) : null}
    </nav>
  );
}
