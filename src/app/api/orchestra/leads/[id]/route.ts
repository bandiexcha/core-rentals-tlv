import { NextResponse } from "next/server";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import {
  extractBearer,
  isOrchestraAuthConfigured,
  serviceUnavailable,
  unauthorized,
  verifyOrchestraApiKey,
} from "@/lib/leads/auth";
import { toOrchestraLeadView } from "@/lib/leads/orchestra";
import { getLead } from "@/lib/leads/store";

interface Ctx {
  params: Promise<{ id: string }>;
}

function requireOrchestra(request: Request) {
  if (!FEATURE_FLAGS.orchestraApi) {
    return { error: serviceUnavailable("Orchestra API disabled by feature flag.") };
  }
  if (!isOrchestraAuthConfigured()) {
    return {
      error: serviceUnavailable("ORCHESTRA_API_KEY is not configured."),
    };
  }
  const key = extractBearer(request) || request.headers.get("x-orchestra-key");
  if (!verifyOrchestraApiKey(key)) {
    return { error: unauthorized() };
  }
  return { ok: true as const };
}

function isOrchestraLead(lead: { source: string; tags: string[]; orchestraExternalId?: string | null }) {
  return (
    lead.source === "orchestra" ||
    lead.tags.includes("orchestra") ||
    Boolean(lead.orchestraExternalId)
  );
}

export async function GET(request: Request, ctx: Ctx) {
  const gate = requireOrchestra(request);
  if ("error" in gate) return gate.error;

  const { id } = await ctx.params;
  const lead = await getLead(id);
  if (!lead || !isOrchestraLead(lead)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ lead: toOrchestraLeadView(lead) });
}
