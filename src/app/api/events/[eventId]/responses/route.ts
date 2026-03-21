import { NextResponse } from "next/server";
import { getApiUser } from '@/lib/auth/api-auth';
import { query, queryOne } from "@/lib/db/client";
import type { PlusOne } from "@/types/database";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const event = await queryOne(
      'SELECT id FROM events WHERE id = $1 AND user_id = $2',
      [eventId, user.id]
    );

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const url = new URL(request.url);
    const format = url.searchParams.get("format");

    // Fetch responses
    const responses = await query(
      'SELECT * FROM rsvp_responses WHERE event_id = $1 ORDER BY submitted_at DESC',
      [eventId]
    );

    // Fetch plus_ones for these responses
    const responseIds = responses.map((r: any) => r.id);
    let plusOnes: PlusOne[] = [];

    if (responseIds.length > 0) {
      const placeholders = responseIds.map((_: string, i: number) => `$${i + 1}`).join(', ');
      plusOnes = await query<PlusOne>(
        `SELECT * FROM plus_ones WHERE rsvp_response_id IN (${placeholders})`,
        responseIds
      );
    }

    // Group plus_ones by response_id
    const plusOnesByResponse = plusOnes.reduce((acc, po) => {
      if (!acc[po.rsvp_response_id]) {
        acc[po.rsvp_response_id] = [];
      }
      acc[po.rsvp_response_id].push(po);
      return acc;
    }, {} as Record<string, PlusOne[]>);

    // Attach plus_ones to responses
    const responsesWithPlusOnes = responses.map((r: any) => ({
      ...r,
      plus_ones: plusOnesByResponse[r.id] || [],
    }));

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
      responses.forEach((r: any) => {
        if (r.response_data && typeof r.response_data === "object") {
          Object.keys(r.response_data as Record<string, unknown>).forEach((k) => dataKeys.add(k));
        }
      });
      const dataKeysList = Array.from(dataKeys);
      headers.push(...dataKeysList);

      const rows = responsesWithPlusOnes.map((r: any) => {
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

      const csv = [headers.join(","), ...rows].join("\n");

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
