import { NextResponse } from "next/server";
import { requireCrmSession } from "@/lib/leads/crm-session";
import { updateCampaignMessage } from "@/lib/reconnect/campaigns";
import { getCampaign } from "@/lib/reconnect/store";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, ctx: Ctx) {
  const auth = await requireCrmSession(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  const { id } = await ctx.params;
  const campaign = await getCampaign(id);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ campaign });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireCrmSession(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  const { id } = await ctx.params;
  let body: {
    subject?: string;
    bodyText?: string;
    whatsappText?: string;
    whatsappTemplateName?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const campaign = await updateCampaignMessage(id, body);
    if (!campaign) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ campaign });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 400 }
    );
  }
}
