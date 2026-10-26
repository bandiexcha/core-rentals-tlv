import { NextResponse } from "next/server";
import { requireCrmSession } from "@/lib/leads/crm-session";
import { leadsToCsv, listLeads } from "@/lib/leads/store";
import type { LeadSource, LeadStatus, RecordKind } from "@/lib/leads/types";

export async function GET(request: Request) {
  const auth = await requireCrmSession(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  const leads = await listLeads({
    limit: Number(url.searchParams.get("limit") || 500),
    status: (url.searchParams.get("status") as LeadStatus) || undefined,
    source: (url.searchParams.get("source") as LeadSource) || undefined,
    kind: (url.searchParams.get("kind") as RecordKind) || undefined,
    q: url.searchParams.get("q") || undefined,
    owner: url.searchParams.get("owner") || undefined,
    actionToday: url.searchParams.get("actionToday") === "1",
  });

  if (format === "csv") {
    return new NextResponse(leadsToCsv(leads), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ leads, count: leads.length });
}
