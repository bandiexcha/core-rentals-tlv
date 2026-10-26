import { NextResponse } from "next/server";
import { requireCrmSession } from "@/lib/leads/crm-session";
import { createCampaign } from "@/lib/reconnect/campaigns";
import { listCampaigns } from "@/lib/reconnect/store";
import type { CampaignChannel } from "@/lib/reconnect/types";

export async function GET(request: Request) {
  const auth = await requireCrmSession(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  const campaigns = await listCampaigns();
  return NextResponse.json({ campaigns });
}

export async function POST(request: Request) {
  const auth = await requireCrmSession(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  let body: {
    name?: string;
    channel?: CampaignChannel;
    mode?: "test" | "live";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.channel || !["email", "whatsapp"].includes(body.channel)) {
    return NextResponse.json({ error: "channel required" }, { status: 400 });
  }

  const campaign = await createCampaign({
    name: body.name || `Reconnect ${body.channel} ${new Date().toISOString().slice(0, 10)}`,
    channel: body.channel,
    mode: body.mode || "test",
  });

  return NextResponse.json({
    campaign,
    note: "Draft created. Review message, send a test, acknowledge lawful basis, then approve before live run.",
  });
}
