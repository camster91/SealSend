import { SOURCE_CODE_URL } from "@/lib/constants";

/**
 * The AGPL section 13 source offer. Shown in the marketing footer, the
 * dashboard and the sign-in pages. If you run a modified SealSend, point
 * SOURCE_CODE_URL at your own source and keep this offer visible to every
 * user who interacts with it, including on guest-facing pages.
 */
export function SourceCodeLink({ className }: { className?: string }) {
  return (
    <a href={SOURCE_CODE_URL} className={className ?? "text-xs text-muted-foreground hover:text-foreground"}>
      Source code (AGPL-3.0)
    </a>
  );
}
