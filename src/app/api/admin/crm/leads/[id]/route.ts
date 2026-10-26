import { NextResponse } from "next/server";
import { requireCrmSession } from "@/lib/leads/crm-session";
import { getLead, updateLead } from "@/lib/leads/store";
import type { LeadStatus, RecordKind } from "@/lib/leads/types";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, ctx: Ctx) {
  const auth = await requireCrmSession(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  const { id } = await ctx.params;
  const lead = await getLead(id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lead });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireCrmSession(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const lead = await updateLead(
      id,
      {
        status: body.status as LeadStatus | undefined,
        owner: typeof body.owner === "string" ? body.owner : undefined,
        kind: body.kind as RecordKind | undefined,
        notes: typeof body.notes === "string" ? body.notes : undefined,
        nextFollowUpAt:
          body.nextFollowUpAt === null
            ? null
            : typeof body.nextFollowUpAt === "string"
              ? body.nextFollowUpAt
              : undefined,
        lostReason:
          typeof body.lostReason === "string" ? body.lostReason : undefined,
        cancelledReason:
          typeof body.cancelledReason === "string"
            ? body.cancelledReason
            : undefined,
        verifiedRevenue:
          body.verifiedRevenue === null
            ? null
            : typeof body.verifiedRevenue === "number"
              ? body.verifiedRevenue
              : undefined,
        verifiedRevenueCurrency:
          typeof body.verifiedRevenueCurrency === "string"
            ? body.verifiedRevenueCurrency
            : undefined,
        optedOut:
          typeof body.optedOut === "boolean" ? body.optedOut : undefined,
        consentMarketing:
          typeof body.consentMarketing === "boolean"
            ? body.consentMarketing
            : undefined,
        destination:
          typeof body.destination === "string" ? body.destination : undefined,
        bedroomsRequested:
          typeof body.bedroomsRequested === "string"
            ? body.bedroomsRequested
            : undefined,
        requirements:
          typeof body.requirements === "string" ? body.requirements : undefined,
      },
      typeof body.actor === "string" ? body.actor : "operator"
    );
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ lead });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 400 }
    );
  }
}
