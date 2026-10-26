import { NextResponse } from "next/server";
import { requireCrmSession } from "@/lib/leads/crm-session";
import { addQuote } from "@/lib/leads/store";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireCrmSession(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  const { id } = await ctx.params;
  let body: {
    propertyIds?: string[];
    propertyNames?: string[];
    currency?: string;
    amount?: number | null;
    notes?: string;
    status?: "draft" | "sent";
    preparedBy?: string;
    send?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const status = body.send || body.status === "sent" ? "sent" : "draft";
  const lead = await addQuote(
    id,
    {
      propertyIds: body.propertyIds ?? [],
      propertyNames: body.propertyNames ?? [],
      currency: body.currency || "ILS",
      amount: body.amount ?? null,
      notes: body.notes,
      sentAt: status === "sent" ? new Date().toISOString() : null,
      status,
      preparedBy: body.preparedBy,
    },
    body.preparedBy || "operator"
  );

  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lead });
}
