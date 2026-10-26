import { NextResponse } from "next/server";
import { requireCrmSession } from "@/lib/leads/crm-session";
import { getReconnectStats } from "@/lib/reconnect/stats";

export async function GET(request: Request) {
  const auth = await requireCrmSession(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  const stats = await getReconnectStats();
  return NextResponse.json({ stats });
}
