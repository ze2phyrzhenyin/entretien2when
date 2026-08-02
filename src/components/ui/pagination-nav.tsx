import { getServerTranslator } from "@/i18n/server";
import Link from "next/link";
import { buildPaginationHref, type Pagination } from "@/lib/pagination";
import { selectPluralValue } from "@/i18n/catalogs";
type PaginationNavProps = Pagination & {
  pathname: string;
  searchParams: Record<string, string | undefined>;
  itemLabel?: string;
  itemLabelOne?: string;
};
export async function PaginationNav({
  pathname,
  searchParams,
  page,
  pageCount,
  pageSize,
  totalCount,
  itemLabel,
  itemLabelOne
}: PaginationNavProps) {
  const { locale, t } = await getServerTranslator();
  const pluralItemLabel = itemLabel ?? t("legacy.records.6016bf63");
  const resolvedItemLabel = selectPluralValue(locale, totalCount, {
    one: itemLabelOne ?? pluralItemLabel,
    other: pluralItemLabel
  });
  if (totalCount === 0) {
    return null;
  }
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);
  const previousHref = buildPaginationHref(pathname, searchParams, page - 1);
  const nextHref = buildPaginationHref(pathname, searchParams, page + 1);
  return (
    <nav
      aria-label={t("legacy.value0_paging.e915a20d", { value0: resolvedItemLabel })}
      className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-surface-subtle px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-muted-foreground" aria-live="polite">
        {t("pagination.summary", {
          start,
          end,
          total: totalCount,
          itemLabel: resolvedItemLabel,
          page,
          pageCount
        })}
      </p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link
              href={previousHref}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {t("legacy.previous_page.c9b9ae7a")}
            </Link>
          ) : (
            <span
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-muted px-3 text-xs font-medium text-muted-foreground"
              aria-disabled="true"
            >
              {t("legacy.previous_page.c9b9ae7a")}
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
              {t("legacy.next_page.8a8542f6")}
            </Link>
          ) : (
            <span
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-muted px-3 text-xs font-medium text-muted-foreground"
              aria-disabled="true"
            >
              {t("legacy.next_page.8a8542f6")}
            </span>
          )}
        </div>
      ) : null}
    </nav>
  );
}
