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
import { addTimelineNote, getLead, updateLead } from "@/lib/leads/store";

interface Ctx {
  params: Promise<{ id: string }>;
}

function requireOrchestra(request: Request) {
  if (!FEATURE_FLAGS.orchestraApi) {
    return { error: serviceUnavailable("Orchestra API disabled.") };
  }
  if (!isOrchestraAuthConfigured()) {
    return { error: serviceUnavailable("ORCHESTRA_API_KEY not configured.") };
  }
  const key = extractBearer(request) || request.headers.get("x-orchestra-key");
  if (!verifyOrchestraApiKey(key)) return { error: unauthorized() };
  return { ok: true as const };
}

/**
 * Request quotation preparation — creates a human operator task.
 * Live prices/availability require manual approval; never auto-priced.
 */
export async function POST(request: Request, ctx: Ctx) {
  const gate = requireOrchestra(request);
  if ("error" in gate) return gate.error;

  const { id } = await ctx.params;
  const lead = await getLead(id);
  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { notes?: string; propertyIds?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    // empty body ok
  }

  const note = [
    "Orchestra requested quotation preparation.",
    "Human approval required for live prices, availability, and contractual terms.",
    body.notes ? `Notes: ${body.notes}` : "",
    body.propertyIds?.length
      ? `Suggested property IDs: ${body.propertyIds.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  await addTimelineNote(id, note, "orchestra");
  const updated = await updateLead(
    id,
    {
      status:
        lead.status === "new_inquiry" || lead.status === "qualified"
          ? "availability_check"
          : lead.status,
      nextFollowUpAt: new Date().toISOString(),
      notes: body.notes,
    },
    "orchestra"
  );

  return NextResponse.json({
    success: true,
    humanTask: {
      type: "quote_preparation",
      requiresApproval: true,
      message:
        "Operator must confirm availability and pricing manually before sending a quote.",
    },
    lead: toOrchestraLeadView(updated ?? lead),
  });
}
