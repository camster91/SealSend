import { NextResponse } from "next/server";
import { getApiUser } from '@/lib/auth/api-auth';
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminSupabase = createAdminClient();

    const { data: event } = await adminSupabase
      .from("events")
      .select("id")
      .eq("id", eventId)
      .eq("user_id", user.id)
      .single();

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const url = new URL(request.url);
    const format = url.searchParams.get("format");

    const { data: responses, error } = await adminSupabase
      .from("rsvp_responses")
      .select("*")
      .eq("event_id", eventId)
      .order("submitted_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // CSV export
    if (format === "csv") {
      const headers = [
        "Name",
        "Email",
        "Status",
        "Headcount",
        "Submitted At",
      ];

      // Get all unique response_data keys
      const dataKeys = new Set<string>();
      responses?.forEach((r) => {
        if (r.response_data && typeof r.response_data === "object") {
          Object.keys(r.response_data as Record<string, unknown>).forEach((k) => dataKeys.add(k));
        }
      });
      const dataKeysList = Array.from(dataKeys);
      headers.push(...dataKeysList);

      const rows = (responses ?? []).map((r) => {
        const rd = (r.response_data || {}) as Record<string, unknown>;
        return [
          r.respondent_name,
          r.respondent_email || "",
          r.status,
          String(r.headcount),
          r.submitted_at,
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

    return NextResponse.json(responses);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
