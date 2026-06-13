import { NextResponse } from "next/server";
import { getApiUser } from '@/lib/auth/api-auth';
import { query } from "@/lib/db/client";
import type { PlusOne, RSVPResponse } from "@/types/database";

type ResponseWithPlusOnes = RSVPResponse & { plus_ones: PlusOne[] };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const format = url.searchParams.get("format");

    // Optimized: Consolidating ownership check, responses fetch, and plus_ones grouping into a single query.
    // This reduces database round-trips from 3 to 1 and eliminates manual grouping in JavaScript.
    const rows = await query<ResponseWithPlusOnes & { _event_id_check: string }>(
      `SELECT r.*,
              COALESCE(
                (SELECT json_agg(p.* ORDER BY p.created_at) FROM plus_ones p WHERE p.rsvp_response_id = r.id),
                '[]'::json
              ) as plus_ones,
              e.id as _event_id_check
       FROM events e
       LEFT JOIN rsvp_responses r ON e.id = r.event_id
       WHERE e.id = $1 AND e.user_id = $2
       ORDER BY r.submitted_at DESC NULLS LAST`,
      [eventId, user.id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // If the event exists but has no responses, the first row will have _event_id_check but r.id will be null
    const responsesWithPlusOnes = rows[0].id ? rows : [];

    // CSV export
    if (format === "csv") {
      const headers = [
        "Name",
        "Email",
        "Status",
        "Headcount",
        "Submitted At",
        "Plus Ones",
        "Plus One Names",
        "Plus One Emails",
      ];

      // Get all unique response_data keys
      const dataKeys = new Set<string>();
      responsesWithPlusOnes.forEach((r) => {
        if (r.response_data && typeof r.response_data === "object") {
          Object.keys(r.response_data as Record<string, unknown>).forEach((k) => dataKeys.add(k));
        }
      });
      const dataKeysList = Array.from(dataKeys);
      headers.push(...dataKeysList);

      const csvRows = responsesWithPlusOnes.map((r) => {
        const rd = (r.response_data || {}) as Record<string, unknown>;
        const plusOnesList = r.plus_ones || [];
        const plusOneNames = plusOnesList.map((po: PlusOne) => po.name).join("; ");
        const plusOneEmails = plusOnesList.map((po: PlusOne) => po.email || "").filter(Boolean).join("; ");

        return [
          r.respondent_name,
          r.respondent_email || "",
          r.status,
          String(r.headcount),
          r.submitted_at,
          String(plusOnesList.length),
          plusOneNames,
          plusOneEmails,
          ...dataKeysList.map((k) => String(rd[k] || "")),
        ]
          .map((v) => {
            let s = String(v).replace(/"/g, '""');
            // Prevent CSV formula injection
            if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
            return `"${s}"`;
          })
          .join(",");
      });

      const csv = [headers.join(","), ...csvRows].join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="responses-${eventId}.csv"`,
        },
      });
    }

    return NextResponse.json(responsesWithPlusOnes);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
