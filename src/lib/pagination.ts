export type Pagination = {
  page: number;
  pageSize: number;
  pageCount: number;
  totalCount: number;
  skip: number;
};

/**
 * Parses a page query value without accepting partial values such as `2foo`.
 * Keeping this bounded also prevents a user-controlled offset from becoming an
 * unexpectedly large database query.
 */
export function parsePageParam(value: string | undefined, maxPage = 10_000) {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    return 1;
  }

  const page = Number(value);
  if (!Number.isSafeInteger(page)) {
    return 1;
  }

  return Math.min(page, maxPage);
}

export function createPagination({
  page: requestedPage,
  pageSize,
  totalCount
}: {
  page: string | undefined;
  pageSize: number;
  totalCount: number;
}): Pagination {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new Error("pageSize must be a positive integer.");
  }

  const safeTotalCount = Math.max(0, totalCount);
  const pageCount = Math.max(1, Math.ceil(safeTotalCount / pageSize));
  const page = Math.min(parsePageParam(requestedPage), pageCount);

  return {
    page,
    pageSize,
    pageCount,
    totalCount: safeTotalCount,
    skip: (page - 1) * pageSize
  };
}

export function buildPaginationHref(
  pathname: string,
  searchParams: Record<string, string | undefined>,
  page: number
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "page") {
      params.set(key, value);
    }
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  params.sort();
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
