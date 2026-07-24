const MAX_BASE_PATH_LENGTH = 200;

function invalidBasePath(value: string): never {
  throw new Error(`NEXT_PUBLIC_BASE_PATH is invalid: ${value}`);
}

/**
 * Normalise the optional Next.js base path once, before it is used for a
 * redirect, a cookie scope, or a public link.  A malformed value must not
 * silently turn a path-scoped cookie into a root-scoped cookie.
 */
export function normalizeBasePath(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed || trimmed === "/") {
    return "";
  }

  if (
    trimmed.length > MAX_BASE_PATH_LENGTH ||
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    trimmed.includes("?") ||
    trimmed.includes("#")
  ) {
    return invalidBasePath(trimmed);
  }

  const normalized = trimmed.replace(/\/+$/, "");
  if (!normalized || normalized === "/") {
    return "";
  }

  if (normalized.split("/").some((segment) => segment === "." || segment === "..")) {
    return invalidBasePath(trimmed);
  }

  return normalized;
}

export function getConfiguredBasePath() {
  return normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
}

export function getRequestBasePath(requestBasePath?: string | null) {
  return requestBasePath ? normalizeBasePath(requestBasePath) : getConfiguredBasePath();
}

export function withBasePath(pathAndSearch: string, basePath = getConfiguredBasePath()) {
  if (!pathAndSearch.startsWith("/") || pathAndSearch.startsWith("//")) {
    throw new Error(`Expected an application-relative path, received: ${pathAndSearch}`);
  }

  const normalizedBasePath = normalizeBasePath(basePath);
  if (!normalizedBasePath) {
    return pathAndSearch;
  }

  const pathname = pathAndSearch.search(/[?#]/);
  const pathOnly = pathname === -1 ? pathAndSearch : pathAndSearch.slice(0, pathname);

  if (pathOnly === normalizedBasePath || pathOnly.startsWith(`${normalizedBasePath}/`)) {
    return pathAndSearch;
  }

  return `${normalizedBasePath}${pathAndSearch}`;
}

export function getSessionCookiePath(basePath = getConfiguredBasePath()) {
  return normalizeBasePath(basePath) || "/";
}

/**
 * Build an externally-visible application URL without duplicating a base path
 * that is already present in APP_URL. APP_URL may be either an origin or the
 * deployed origin plus its basePath.
 */
export function getPublicAppUrl(pathAndSearch: string) {
  const configuredBasePath = getConfiguredBasePath();
  const rawAppUrl = process.env.APP_URL?.trim() || "http://localhost:3000";
  let appUrl: URL;

  try {
    appUrl = new URL(rawAppUrl);
  } catch {
    throw new Error("APP_URL must be an absolute URL.");
  }

  if (appUrl.username || appUrl.password) {
    throw new Error("APP_URL must not contain credentials.");
  }

  if (process.env.NODE_ENV === "production" && appUrl.protocol !== "https:") {
    throw new Error("APP_URL must use HTTPS in production.");
  }

  const appUrlBasePath = normalizeBasePath(appUrl.pathname);
  if (
    (configuredBasePath && appUrlBasePath && configuredBasePath !== appUrlBasePath) ||
    (process.env.NODE_ENV === "production" && !configuredBasePath && appUrlBasePath)
  ) {
    throw new Error("APP_URL path must match NEXT_PUBLIC_BASE_PATH.");
  }

  if (!pathAndSearch.startsWith("/") || pathAndSearch.startsWith("//")) {
    throw new Error(`Expected an application-relative path, received: ${pathAndSearch}`);
  }

  const relativeUrl = new URL(pathAndSearch, "https://when2entretien.invalid");
  const basePath = configuredBasePath || appUrlBasePath;

  appUrl.pathname = withBasePath(relativeUrl.pathname, basePath);
  appUrl.search = relativeUrl.search;
  appUrl.hash = relativeUrl.hash;

  return appUrl.toString();
}

/** Build the canonical public candidate entry URL for a group. */
export function getCandidateGroupPublicUrl(groupCode: string) {
  return getPublicAppUrl(`/candidate/${encodeURIComponent(groupCode)}`);
}
