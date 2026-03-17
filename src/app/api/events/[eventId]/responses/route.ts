import { NextResponse } from "next/server";
import { getApiUser } from '@/lib/auth/api-auth';
import { prisma } from '@/lib/db';
import type { PlusOne } from "@/types/database";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const event = await prisma.event.findFirst({
      where: { id: eventId, user_id: user.id },
      select: { id: true },
    });

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const url = new URL(request.url);
    const format = url.searchParams.get("format");

    // Fetch responses with their plus_ones
    const responses = await prisma.rsvpResponse.findMany({
      where: { event_id: eventId },
      orderBy: { submitted_at: 'desc' },
    });

    // Fetch plus_ones for these responses
    const responseIds = responses?.map(r => r.id) || [];
    let plusOnes: PlusOne[] = [];

    if (responseIds.length > 0) {
      const plusOnesData = await prisma.plusOne.findMany({
        where: { rsvp_response_id: { in: responseIds } },
      });

      if (plusOnesData) {
        plusOnes = plusOnesData as unknown as PlusOne[];
      }
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
    const responsesWithPlusOnes = responses?.map(r => ({
      ...r,
      plus_ones: plusOnesByResponse[r.id] || [],
    })) || [];

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
      responses?.forEach((r) => {
        if (r.response_data && typeof r.response_data === "object") {
          Object.keys(r.response_data as Record<string, unknown>).forEach((k) => dataKeys.add(k));
        }
      });
      const dataKeysList = Array.from(dataKeys);
      headers.push(...dataKeysList);

      const rows = (responsesWithPlusOnes ?? []).map((r) => {
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
