type JsonLdData = Record<string, unknown>;

/**
 * Safely serializes JSON-LD data for embedding in a <script> tag.
 * Escapes characters that could break out of the script context:
 * - </ is escaped to <\/ to prevent script tag termination
 * - HTML entities are preserved via JSON.stringify's default escaping
 * - Unicode line/paragraph separators are escaped
 */
function safeStringify(data: unknown): string {
  return JSON.stringify(data)
    .replace(/<\//g, "<\\/")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function JsonLd({ data }: { data: JsonLdData | JsonLdData[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeStringify(data) }}
    />
  );
}
