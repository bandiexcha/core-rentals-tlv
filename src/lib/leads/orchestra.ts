import type { Lead } from "@/lib/leads/types";

/** Public fields Orchestra may read — never full PII dump of all leads. */
export type OrchestraLeadView = {
  id: string;
  externalId: string | null;
  status: Lead["status"];
  source: Lead["source"];
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  utmCampaign?: string;
  campaignSlug?: string;
  quoteCount: number;
  hasVerifiedRevenue: boolean;
  verifiedRevenue: number | null;
  bookingConfirmedAt: string | null;
  lostReason?: string;
  cancelledReason?: string;
  nextFollowUpAt: string | null;
};

export function toOrchestraLeadView(lead: Lead): OrchestraLeadView {
  return {
    id: lead.id,
    externalId: lead.orchestraExternalId ?? null,
    status: lead.status,
    source: lead.source,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    lastActivityAt: lead.lastActivityAt,
    utmCampaign: lead.attribution.utmCampaign,
    campaignSlug: lead.attribution.campaignSlug,
    quoteCount: lead.quotes.length,
    hasVerifiedRevenue: lead.verifiedRevenue != null,
    verifiedRevenue: lead.verifiedRevenue ?? null,
    bookingConfirmedAt: lead.bookingConfirmedAt ?? null,
    lostReason: lead.lostReason,
    cancelledReason: lead.cancelledReason,
    nextFollowUpAt: lead.nextFollowUpAt ?? null,
  };
}
