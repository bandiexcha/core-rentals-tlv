import type { Lead, LeadMetrics, LeadSource, LeadStatus } from "@/lib/leads/types";
import { LEAD_STATUSES } from "@/lib/leads/types";
import { listLeads } from "@/lib/leads/store";

function emptyByStatus(): Record<LeadStatus, number> {
  return Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<
    LeadStatus,
    number
  >;
}

function ratio(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 1000;
}

export function computeLeadMetrics(leads: Lead[]): LeadMetrics {
  const active = leads.filter((l) => l.kind === "lead");
  const byStatus = emptyByStatus();
  const bySource: Partial<Record<LeadSource, number>> = {};

  let realizedSum = 0;
  let realizedCount = 0;
  let actionToday = 0;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  for (const lead of active) {
    byStatus[lead.status] = (byStatus[lead.status] ?? 0) + 1;
    bySource[lead.source] = (bySource[lead.source] ?? 0) + 1;

    if (
      lead.verifiedRevenue != null &&
      (lead.status === "confirmed" || lead.status === "completed")
    ) {
      realizedSum += lead.verifiedRevenue;
      realizedCount += 1;
    }

    if (lead.nextFollowUpAt) {
      const t = new Date(lead.nextFollowUpAt).getTime();
      if (t >= start.getTime() && t <= end.getTime()) actionToday += 1;
    }
  }

  const newLeads = byStatus.new_inquiry;
  const qualified =
    byStatus.qualified +
    byStatus.availability_check +
    byStatus.quote_prepared +
    byStatus.quote_sent +
    byStatus.negotiation +
    byStatus.confirmed +
    byStatus.completed;
  const quotesPrepared =
    byStatus.quote_prepared +
    byStatus.quote_sent +
    byStatus.negotiation +
    byStatus.confirmed +
    byStatus.completed;
  const quotesSent =
    byStatus.quote_sent +
    byStatus.negotiation +
    byStatus.confirmed +
    byStatus.completed;
  const confirmed = byStatus.confirmed + byStatus.completed;
  const completed = byStatus.completed;
  const lostOrCancelled = byStatus.lost + byStatus.cancelled;

  const pipelineEntered = active.filter(
    (l) => l.status !== "lost" && l.status !== "cancelled"
  ).length;

  return {
    generatedAt: new Date().toISOString(),
    totalLeads: active.length,
    byStatus,
    bySource,
    newLeads,
    qualified,
    quotesPrepared,
    quotesSent,
    confirmed,
    completed,
    lostOrCancelled,
    actionToday,
    realizedRevenue: realizedCount > 0 ? realizedSum : null,
    conversionInquiryToQualified: ratio(qualified, active.length),
    conversionQualifiedToQuoteSent: ratio(quotesSent, Math.max(qualified, 1)),
    conversionQuoteToConfirmed: ratio(confirmed, Math.max(quotesSent, 1)),
    note:
      realizedCount === 0
        ? "Revenue and CAC fields are null until operators enter verified booking amounts. Cost-per-lead is omitted until real spend data is configured."
        : `Realized revenue sums verified amounts on ${realizedCount} confirmed/completed lead(s) only. CAC omitted until spend data exists. Pipeline size: ${pipelineEntered}.`,
  };
}

export async function getLeadMetrics(): Promise<LeadMetrics> {
  const leads = await listLeads({ limit: 2000, kind: "lead" });
  return computeLeadMetrics(leads);
}
