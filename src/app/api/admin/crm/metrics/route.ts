import { NextResponse } from "next/server";
import { requireCrmSession } from "@/lib/leads/crm-session";
import { getLeadMetrics } from "@/lib/leads/metrics";

export async function GET(request: Request) {
  const auth = await requireCrmSession(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  const metrics = await getLeadMetrics();
  return NextResponse.json({ metrics });
}
