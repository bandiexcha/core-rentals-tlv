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
import { createLead, listLeads } from "@/lib/leads/store";
import type { Attribution, LeadSource } from "@/lib/leads/types";

function requireOrchestra(request: Request) {
  if (!FEATURE_FLAGS.orchestraApi) {
    return { error: serviceUnavailable("Orchestra API disabled by feature flag.") };
  }
  if (!isOrchestraAuthConfigured()) {
    return {
      error: serviceUnavailable(
        "ORCHESTRA_API_KEY is not configured. Integration blocked until owner sets credentials."
      ),
    };
  }
  const key = extractBearer(request) || request.headers.get("x-orchestra-key");
  if (!verifyOrchestraApiKey(key)) {
    return { error: unauthorized("Invalid Orchestra API key") };
  }
  return { ok: true as const };
}

/**
 * Submit or synchronize a qualified lead from Orchestra.
 * Does not return the full customer database.
 */
export async function POST(request: Request) {
  const gate = requireOrchestra(request);
  if ("error" in gate) return gate.error;

  let body: {
    externalId?: string;
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
    checkin?: string;
    checkout?: string;
    guests?: string;
    bedroomsRequested?: string;
    destination?: string;
    requirements?: string;
    apartment?: string;
    propertyIds?: string[];
    source?: LeadSource;
    attribution?: Attribution;
    consentMarketing?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.name?.trim() || !body.email?.trim()) {
    return NextResponse.json(
      { error: "name and email are required" },
      { status: 400 }
    );
  }

  const attribution: Attribution = {
    ...(body.attribution ?? {}),
    utmSource: body.attribution?.utmSource || "orchestra",
    utmMedium: body.attribution?.utmMedium || "partner",
  };

  const lead = await createLead({
    name: body.name,
    email: body.email,
    phone: body.phone,
    message: body.message,
    notes: body.message,
    checkin: body.checkin,
    checkout: body.checkout,
    guests: body.guests,
    bedroomsRequested: body.bedroomsRequested,
    destination: body.destination,
    requirements: body.requirements,
    apartment: body.apartment,
    propertyIds: body.propertyIds,
    source: body.source || "orchestra",
    attribution,
    consentMarketing: body.consentMarketing,
    orchestraExternalId: body.externalId ?? null,
    tags: ["orchestra"],
    owner: "orchestra-intake",
  });

  // Mark as qualified when Orchestra already vetted
  const { updateLead } = await import("@/lib/leads/store");
  const qualified = await updateLead(
    lead.id,
    { status: "qualified" },
    "orchestra"
  );

  return NextResponse.json({
    success: true,
    lead: toOrchestraLeadView(qualified ?? lead),
  });
}

/**
 * Limited list: statuses/outcomes only for leads Orchestra created or tagged.
 * Never returns the entire CRM database.
 */
export async function GET(request: Request) {
  const gate = requireOrchestra(request);
  if ("error" in gate) return gate.error;

  const url = new URL(request.url);
  const externalId = url.searchParams.get("externalId");
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 50);

  let leads = await listLeads({ limit: 500, kind: "lead" });
  leads = leads.filter(
    (l) =>
      l.source === "orchestra" ||
      l.tags.includes("orchestra") ||
      Boolean(l.orchestraExternalId)
  );

  if (externalId) {
    leads = leads.filter((l) => l.orchestraExternalId === externalId);
  }

  return NextResponse.json({
    leads: leads.slice(0, limit).map(toOrchestraLeadView),
    count: Math.min(leads.length, limit),
    note: "Only Orchestra-sourced leads are returned. Full CRM export is not available via this API.",
  });
}
