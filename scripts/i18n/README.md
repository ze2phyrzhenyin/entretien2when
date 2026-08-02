# Internationalization checks

`pnpm i18n:check` verifies catalog key/placeholder parity and confirms that every
Chinese application literal discovered by the TypeScript AST is represented in
the auditable `zh-CN`/`en` catalog pair.

`node scripts/i18n/generate-catalogs.mjs` regenerates the legacy catalog adapter
for newly discovered literals. Generated English copy must be reviewed before
release. New product work should call semantic catalog keys through
`useLocale().t(...)`; the legacy adapter exists to cover the established server
and client component surface without changing form, scheduling, or authorization
semantics.
