import { NextResponse } from "next/server";
import { SITE } from "@/lib/constants";
import { requireCrmSession } from "@/lib/leads/crm-session";
import {
  approveCampaign,
  pauseCampaign,
  requestApproval,
  resumeCampaign,
  runCampaignBatch,
  sendTestEmail,
} from "@/lib/reconnect/campaigns";
import { getCampaign } from "@/lib/reconnect/store";

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
    action?: string;
    toEmail?: string;
    lawfulBasisAcknowledged?: boolean;
    mode?: "test" | "live";
    limit?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const action = body.action;
  try {
    if (action === "test") {
      const to = body.toEmail?.trim() || SITE.inquiryEmail;
      const result = await sendTestEmail(id, to);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, campaign: result.campaign, testedTo: to });
    }

    if (action === "request_approval") {
      const campaign = await requestApproval(id, {
        lawfulBasisAcknowledged: Boolean(body.lawfulBasisAcknowledged),
        mode: body.mode || "test",
      });
      return NextResponse.json({ campaign });
    }

    if (action === "approve") {
      const campaign = await approveCampaign(id, "owner");
      return NextResponse.json({
        campaign,
        costEstimate: campaign?.costEstimate,
        note: "Approved. Run batches explicitly — nothing sends until you call run.",
      });
    }

    if (action === "run") {
      const before = await getCampaign(id);
      if (!before) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (before.mode === "live" && !before.ownerApproved) {
        return NextResponse.json(
          { error: "Live mode requires owner approval first" },
          { status: 403 }
        );
      }
      const campaign = await runCampaignBatch(id, body.limit);
      return NextResponse.json({ campaign });
    }

    if (action === "pause") {
      return NextResponse.json({ campaign: await pauseCampaign(id) });
    }

    if (action === "resume") {
      return NextResponse.json({ campaign: await resumeCampaign(id) });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 400 }
    );
  }
}
