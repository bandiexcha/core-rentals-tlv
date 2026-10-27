import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import type {
  Attribution,
  Lead,
  LeadSource,
  LeadStatus,
  LeadTimelineEntry,
  QuoteVersion,
  RecordKind,
} from "@/lib/leads/types";
import { LEAD_STATUSES } from "@/lib/leads/types";
import { inferLeadSource, mergeAttribution } from "@/lib/leads/attribution";
import { getUpstashRestConfig, isUpstashConfigured } from "@/lib/upstash";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "leads.json");
const LEADS_INDEX_KEY = "leads:ids";
const leadKey = (id: string) => `lead:${id}`;

function nowIso(): string {
  return new Date().toISOString();
}

function timelineEntry(
  type: string,
  message: string,
  actor?: string,
  meta?: Record<string, unknown>
): LeadTimelineEntry {
  return {
    id: randomUUID(),
    at: nowIso(),
    type,
    message,
    actor,
    meta,
  };
}

async function upstashConfigured(): Promise<boolean> {
  return isUpstashConfigured();
}

async function upstashFetch(
  command: (string | number)[]
): Promise<{ result?: unknown; error?: string } | null> {
  const cfg = getUpstashRestConfig();
  if (!cfg) return null;

  const response = await fetch(cfg.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) return null;
  return (await response.json()) as { result?: unknown; error?: string };
}

async function readFsLeads(): Promise<Lead[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Lead[]) : [];
  } catch {
    return [];
  }
}

async function writeFsLeads(leads: Lead[]): Promise<boolean> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(leads, null, 2) + "\n");
    return true;
  } catch {
    return false;
  }
}

async function saveLeadUpstash(lead: Lead): Promise<boolean> {
  const set = await upstashFetch(["SET", leadKey(lead.id), JSON.stringify(lead)]);
  if (!set || set.error) return false;

  // Keep newest IDs at the head; avoid duplicates by LREM then LPUSH
  await upstashFetch(["LREM", LEADS_INDEX_KEY, 0, lead.id]);
  const push = await upstashFetch(["LPUSH", LEADS_INDEX_KEY, lead.id]);
  return Boolean(push && !push.error);
}

async function getLeadUpstash(id: string): Promise<Lead | null> {
  const res = await upstashFetch(["GET", leadKey(id)]);
  if (!res?.result || typeof res.result !== "string") return null;
  try {
    return JSON.parse(res.result) as Lead;
  } catch {
    return null;
  }
}

async function listLeadsUpstash(limit = 500): Promise<Lead[]> {
  const idsRes = await upstashFetch(["LRANGE", LEADS_INDEX_KEY, 0, limit - 1]);
  const ids = Array.isArray(idsRes?.result)
    ? (idsRes!.result as string[])
    : [];
  if (ids.length === 0) return [];

  const leads: Lead[] = [];
  for (const id of ids) {
    const lead = await getLeadUpstash(id);
    if (lead) leads.push(lead);
  }
  return leads;
}

export type CreateLeadInput = {
  name: string;
  email: string;
  phone?: string;
  apartment?: string;
  apartmentSlug?: string;
  propertyIds?: string[];
  checkin?: string;
  checkout?: string;
  guests?: string;
  bedroomsRequested?: string;
  destination?: string;
  requirements?: string;
  notes?: string;
  message?: string;
  attribution?: Attribution;
  source?: LeadSource;
  kind?: RecordKind;
  consentMarketing?: boolean;
  emailSent?: boolean;
  emailProvider?: string | null;
  emailMessageId?: string | null;
  orchestraExternalId?: string | null;
  tags?: string[];
  owner?: string;
};

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  const createdAt = nowIso();
  const attribution = input.attribution ?? {};
  const source = input.source ?? inferLeadSource(attribution);

  const lead: Lead = {
    id: randomUUID(),
    createdAt,
    updatedAt: createdAt,
    kind: input.kind ?? "lead",
    status: "new_inquiry",
    owner: input.owner,
    source,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim(),
    apartment: input.apartment?.trim(),
    apartmentSlug: input.apartmentSlug?.trim(),
    propertyIds: input.propertyIds ?? [],
    checkin: input.checkin?.trim(),
    checkout: input.checkout?.trim(),
    guests: input.guests?.trim(),
    bedroomsRequested: input.bedroomsRequested?.trim(),
    destination: input.destination?.trim(),
    requirements: input.requirements?.trim(),
    notes: input.notes?.trim(),
    message: input.message?.trim() || input.notes?.trim(),
    attribution,
    consentMarketing: input.consentMarketing ?? false,
    optedOut: false,
    nextFollowUpAt: null,
    lastActivityAt: createdAt,
    verifiedRevenue: null,
    bookingConfirmedAt: null,
    emailSent: input.emailSent ?? false,
    emailProvider: input.emailProvider ?? null,
    emailMessageId: input.emailMessageId ?? null,
    quotes: [],
    timeline: [
      timelineEntry("created", "Lead created from website inquiry", "system", {
        source,
      }),
    ],
    tags: input.tags ?? [],
    duplicateOf: null,
    orchestraExternalId: input.orchestraExternalId ?? null,
  };

  // Duplicate detection — flag only, never auto-merge
  const existing = await listLeads({ limit: 200 });
  const dup = existing.find(
    (l) =>
      l.id !== lead.id &&
      l.kind === "lead" &&
      !l.optedOut &&
      l.email === lead.email &&
      Math.abs(new Date(l.createdAt).getTime() - Date.now()) < 1000 * 60 * 60 * 24 * 30
  );
  if (dup) {
    lead.duplicateOf = dup.id;
    lead.timeline.push(
      timelineEntry(
        "duplicate_flagged",
        `Possible duplicate of lead ${dup.id} (same email within 30 days)`,
        "system"
      )
    );
  }

  let stored = await writeFsLeads([...(await readFsLeads()), lead]);
  if (!stored && (await upstashConfigured())) {
    stored = await saveLeadUpstash(lead);
  } else if (stored && (await upstashConfigured())) {
    // Dual-write when both available
    await saveLeadUpstash(lead);
  }

  if (!stored) {
    throw new Error("No lead storage available (filesystem and Upstash both unavailable)");
  }

  return lead;
}

export type ListLeadsOptions = {
  limit?: number;
  status?: LeadStatus;
  source?: LeadSource;
  kind?: RecordKind;
  q?: string;
  owner?: string;
  actionToday?: boolean;
  optedOut?: boolean;
};

export async function listLeads(opts: ListLeadsOptions = {}): Promise<Lead[]> {
  const limit = opts.limit ?? 500;
  let leads: Lead[] = [];

  if (await upstashConfigured()) {
    leads = await listLeadsUpstash(limit);
  }
  if (leads.length === 0) {
    leads = await readFsLeads();
  }

  // Newest first
  leads.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (opts.kind) leads = leads.filter((l) => l.kind === opts.kind);
  if (opts.status) leads = leads.filter((l) => l.status === opts.status);
  if (opts.source) leads = leads.filter((l) => l.source === opts.source);
  if (opts.owner) {
    const o = opts.owner.toLowerCase();
    leads = leads.filter((l) => (l.owner || "").toLowerCase() === o);
  }
  if (opts.optedOut === true) leads = leads.filter((l) => l.optedOut);
  if (opts.optedOut === false) leads = leads.filter((l) => !l.optedOut);
  if (opts.actionToday) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    leads = leads.filter((l) => {
      if (!l.nextFollowUpAt) return false;
      const t = new Date(l.nextFollowUpAt).getTime();
      return t >= start.getTime() && t <= end.getTime();
    });
  }
  if (opts.q?.trim()) {
    const q = opts.q.trim().toLowerCase();
    leads = leads.filter(
      (l) =>
        l.id.toLowerCase().includes(q) ||
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.phone || "").toLowerCase().includes(q) ||
        (l.apartment || "").toLowerCase().includes(q) ||
        (l.message || "").toLowerCase().includes(q) ||
        (l.attribution.utmCampaign || "").toLowerCase().includes(q)
    );
  }

  return leads.slice(0, limit);
}

export async function getLead(id: string): Promise<Lead | null> {
  if (await upstashConfigured()) {
    const fromRedis = await getLeadUpstash(id);
    if (fromRedis) return fromRedis;
  }
  const fsLeads = await readFsLeads();
  return fsLeads.find((l) => l.id === id) ?? null;
}

export type UpdateLeadInput = Partial<{
  status: LeadStatus;
  owner: string;
  kind: RecordKind;
  notes: string;
  nextFollowUpAt: string | null;
  lostReason: string;
  cancelledReason: string;
  verifiedRevenue: number | null;
  verifiedRevenueCurrency: string;
  bookingConfirmedAt: string | null;
  optedOut: boolean;
  consentMarketing: boolean;
  tags: string[];
  destination: string;
  bedroomsRequested: string;
  requirements: string;
  attribution: Attribution;
}>;

export async function updateLead(
  id: string,
  patch: UpdateLeadInput,
  actor = "operator"
): Promise<Lead | null> {
  const lead = await getLead(id);
  if (!lead) return null;

  const updatedAt = nowIso();
  const next: Lead = { ...lead, updatedAt, lastActivityAt: updatedAt };

  if (patch.status && patch.status !== lead.status) {
    if (!LEAD_STATUSES.includes(patch.status)) {
      throw new Error(`Invalid status: ${patch.status}`);
    }
    next.status = patch.status;
    next.timeline = [
      ...next.timeline,
      timelineEntry(
        "status_change",
        `Status: ${lead.status} → ${patch.status}`,
        actor,
        { from: lead.status, to: patch.status }
      ),
    ];
    if (patch.status === "confirmed" && !next.bookingConfirmedAt) {
      next.bookingConfirmedAt = updatedAt;
    }
  }

  if (patch.owner !== undefined && patch.owner !== lead.owner) {
    next.owner = patch.owner;
    next.timeline = [
      ...next.timeline,
      timelineEntry("owner_change", `Owner set to ${patch.owner || "(unassigned)"}`, actor),
    ];
  }

  if (patch.kind !== undefined) next.kind = patch.kind;
  if (patch.notes !== undefined) {
    next.notes = patch.notes;
    next.timeline = [
      ...next.timeline,
      timelineEntry("note", patch.notes.slice(0, 200), actor),
    ];
  }
  if (patch.nextFollowUpAt !== undefined) {
    next.nextFollowUpAt = patch.nextFollowUpAt;
    next.timeline = [
      ...next.timeline,
      timelineEntry(
        "follow_up",
        patch.nextFollowUpAt
          ? `Next follow-up: ${patch.nextFollowUpAt}`
          : "Follow-up cleared",
        actor
      ),
    ];
  }
  if (patch.lostReason !== undefined) next.lostReason = patch.lostReason;
  if (patch.cancelledReason !== undefined) {
    next.cancelledReason = patch.cancelledReason;
  }
  if (patch.verifiedRevenue !== undefined) {
    next.verifiedRevenue = patch.verifiedRevenue;
    next.timeline = [
      ...next.timeline,
      timelineEntry(
        "revenue",
        patch.verifiedRevenue == null
          ? "Verified revenue cleared"
          : `Verified revenue set to ${patch.verifiedRevenue}`,
        actor
      ),
    ];
  }
  if (patch.verifiedRevenueCurrency !== undefined) {
    next.verifiedRevenueCurrency = patch.verifiedRevenueCurrency;
  }
  if (patch.bookingConfirmedAt !== undefined) {
    next.bookingConfirmedAt = patch.bookingConfirmedAt;
  }
  if (patch.optedOut !== undefined) {
    next.optedOut = patch.optedOut;
    if (patch.optedOut) {
      next.timeline = [
        ...next.timeline,
        timelineEntry("opt_out", "Contact opted out of marketing", actor),
      ];
    }
  }
  if (patch.consentMarketing !== undefined) {
    next.consentMarketing = patch.consentMarketing;
  }
  if (patch.tags !== undefined) next.tags = patch.tags;
  if (patch.destination !== undefined) next.destination = patch.destination;
  if (patch.bedroomsRequested !== undefined) {
    next.bedroomsRequested = patch.bedroomsRequested;
  }
  if (patch.requirements !== undefined) next.requirements = patch.requirements;
  if (patch.attribution !== undefined) {
    next.attribution = mergeAttribution(lead.attribution, patch.attribution);
  }

  await persistLead(next);
  return next;
}

export async function addQuote(
  leadId: string,
  quote: Omit<QuoteVersion, "id" | "version" | "createdAt" | "status"> & {
    status?: QuoteVersion["status"];
  },
  actor = "operator"
): Promise<Lead | null> {
  const lead = await getLead(leadId);
  if (!lead) return null;

  const version = lead.quotes.length + 1;
  const superseded = lead.quotes.map((q) =>
    q.status === "draft" || q.status === "sent"
      ? { ...q, status: "superseded" as const }
      : q
  );

  const entry: QuoteVersion = {
    id: randomUUID(),
    version,
    createdAt: nowIso(),
    preparedBy: quote.preparedBy ?? actor,
    propertyIds: quote.propertyIds,
    propertyNames: quote.propertyNames,
    currency: quote.currency,
    amount: quote.amount ?? null,
    notes: quote.notes,
    sentAt: quote.sentAt ?? null,
    status: quote.status ?? "draft",
  };

  const updatedAt = nowIso();
  const next: Lead = {
    ...lead,
    updatedAt,
    lastActivityAt: updatedAt,
    quotes: [...superseded, entry],
    status:
      entry.status === "sent"
        ? "quote_sent"
        : lead.status === "new_inquiry" || lead.status === "qualified"
          ? "quote_prepared"
          : lead.status,
    timeline: [
      ...lead.timeline,
      timelineEntry(
        "quote",
        `Quote v${version} ${entry.status}${entry.amount != null ? ` (${entry.amount} ${entry.currency || ""})` : " (amount pending)"}`,
        actor
      ),
    ],
  };

  await persistLead(next);
  return next;
}

export async function addTimelineNote(
  leadId: string,
  message: string,
  actor = "operator"
): Promise<Lead | null> {
  const lead = await getLead(leadId);
  if (!lead) return null;
  const updatedAt = nowIso();
  const next: Lead = {
    ...lead,
    updatedAt,
    lastActivityAt: updatedAt,
    timeline: [...lead.timeline, timelineEntry("note", message, actor)],
  };
  await persistLead(next);
  return next;
}

async function persistLead(lead: Lead): Promise<void> {
  let stored = false;

  const fsLeads = await readFsLeads();
  const idx = fsLeads.findIndex((l) => l.id === lead.id);
  if (idx >= 0) fsLeads[idx] = lead;
  else fsLeads.push(lead);
  stored = await writeFsLeads(fsLeads);

  if (await upstashConfigured()) {
    const ok = await saveLeadUpstash(lead);
    stored = stored || ok;
  }

  if (!stored) {
    throw new Error("Failed to persist lead");
  }
}

export function leadsToCsv(leads: Lead[]): string {
  const headers = [
    "id",
    "createdAt",
    "status",
    "kind",
    "source",
    "owner",
    "name",
    "email",
    "phone",
    "apartment",
    "checkin",
    "checkout",
    "guests",
    "destination",
    "utmSource",
    "utmMedium",
    "utmCampaign",
    "landingPage",
    "inquiryPage",
    "nextFollowUpAt",
    "verifiedRevenue",
    "lostReason",
    "cancelledReason",
    "optedOut",
    "duplicateOf",
  ];

  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const rows = leads.map((l) =>
    [
      l.id,
      l.createdAt,
      l.status,
      l.kind,
      l.source,
      l.owner ?? "",
      l.name,
      l.email,
      l.phone ?? "",
      l.apartment ?? "",
      l.checkin ?? "",
      l.checkout ?? "",
      l.guests ?? "",
      l.destination ?? "",
      l.attribution.utmSource ?? "",
      l.attribution.utmMedium ?? "",
      l.attribution.utmCampaign ?? "",
      l.attribution.landingPage ?? "",
      l.attribution.inquiryPage ?? "",
      l.nextFollowUpAt ?? "",
      l.verifiedRevenue ?? "",
      l.lostReason ?? "",
      l.cancelledReason ?? "",
      l.optedOut ? "yes" : "no",
      l.duplicateOf ?? "",
    ]
      .map(escape)
      .join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}
