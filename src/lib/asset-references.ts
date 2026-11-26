/**
 * Single source of truth for checking whether uploaded media paths are referenced
 * by any active event, customization asset, workspace brand, or guest album photo.
 * Used by both orphan-upload cleanup and account-deletion cleanup.
 */

/** Evaluates true when upload path column `pathExpr` (e.g. `a.path`) is referenced anywhere. */
export function isUploadPathReferencedSql(pathExpr: string): string {
  return `(
    EXISTS (
      SELECT 1 FROM events e
       WHERE e.design_url = ${pathExpr}
          OR json_extract(e.customization, '$.logoUrl') = ${pathExpr}
          OR json_extract(e.customization, '$.backgroundImage') = ${pathExpr}
          OR json_extract(e.customization, '$.audioUrl') = ${pathExpr}
    )
    OR EXISTS (SELECT 1 FROM brands b WHERE b.logo_url = ${pathExpr})
    OR EXISTS (SELECT 1 FROM event_social_photos p WHERE p.storage_path = ${pathExpr})
  )`;
}

/** Evaluates true when any active record still references a URL matching LIKE `patternParam` (e.g. `/uploads/<userId>/%`). */
export function hasUploadPrefixReferenceSql(patternParam: string): string {
  return `SELECT 1 AS ok FROM events
    WHERE design_url LIKE ${patternParam}
       OR json_extract(customization, '$.logoUrl') LIKE ${patternParam}
       OR json_extract(customization, '$.backgroundImage') LIKE ${patternParam}
       OR json_extract(customization, '$.audioUrl') LIKE ${patternParam}
   UNION ALL
   SELECT 1 AS ok FROM brands WHERE logo_url LIKE ${patternParam}
   UNION ALL
   SELECT 1 AS ok FROM event_social_photos WHERE storage_path LIKE ${patternParam}
   LIMIT 1`;
}
