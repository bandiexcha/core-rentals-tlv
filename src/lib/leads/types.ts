/** Commercial lead lifecycle — inquiry → quote → booking (no invented revenue). */

export const LEAD_STATUSES = [
  "new_inquiry",
  "qualified",
  "availability_check",
  "quote_prepared",
  "quote_sent",
  "negotiation",
  "confirmed",
  "completed",
  "lost",
  "cancelled",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new_inquiry: "New Inquiry",
  qualified: "Qualified",
  availability_check: "Availability Check",
  quote_prepared: "Quote Prepared",
  quote_sent: "Quote Sent",
  negotiation: "Negotiation",
  confirmed: "Confirmed",
  completed: "Completed",
  lost: "Lost",
  cancelled: "Cancelled",
};

export const LEAD_SOURCES = [
  "website",
  "organic_search",
  "paid_search",
  "social",
  "partner",
  "corporate",
  "film_production",
  "community",
  "orchestra",
  "direct",
  "other",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

export const RECORD_KINDS = [
  "lead",
  "historical_contact",
  "corporate_prospect",
  "supplier",
] as const;

export type RecordKind = (typeof RECORD_KINDS)[number];

export interface Attribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  gclid?: string;
  fbclid?: string;
  referrer?: string;
  landingPage?: string;
  inquiryPage?: string;
  campaignSlug?: string;
}

export interface LeadTimelineEntry {
  id: string;
  at: string;
  type: string;
  message: string;
  actor?: string;
  meta?: Record<string, unknown>;
}

export interface QuoteVersion {
  id: string;
  version: number;
  createdAt: string;
  preparedBy?: string;
  propertyIds: string[];
  propertyNames: string[];
  currency?: string;
  /** Only when operator enters a verified figure — never invent. */
  amount?: number | null;
  notes?: string;
  sentAt?: string | null;
  status: "draft" | "sent" | "superseded" | "accepted" | "declined";
}

export interface Lead {
  id: string;
  createdAt: string;
  updatedAt: string;
  kind: RecordKind;
  status: LeadStatus;
  owner?: string;
  source: LeadSource;
  name: string;
  email: string;
  phone?: string;
  apartment?: string;
  apartmentSlug?: string;
  propertyIds: string[];
  checkin?: string;
  checkout?: string;
  guests?: string;
  bedroomsRequested?: string;
  destination?: string;
  requirements?: string;
  notes?: string;
  message?: string;
  attribution: Attribution;
  consentMarketing?: boolean;
  optedOut?: boolean;
  nextFollowUpAt?: string | null;
  lastActivityAt: string;
  lostReason?: string;
  cancelledReason?: string;
  /** Verified booking revenue only — null until operator confirms. */
  verifiedRevenue?: number | null;
  verifiedRevenueCurrency?: string;
  bookingConfirmedAt?: string | null;
  emailSent: boolean;
  emailProvider?: string | null;
  emailMessageId?: string | null;
  quotes: QuoteVersion[];
  timeline: LeadTimelineEntry[];
  tags: string[];
  duplicateOf?: string | null;
  orchestraExternalId?: string | null;
}

export interface LeadMetrics {
  generatedAt: string;
  totalLeads: number;
  byStatus: Record<LeadStatus, number>;
  bySource: Partial<Record<LeadSource, number>>;
  newLeads: number;
  qualified: number;
  quotesPrepared: number;
  quotesSent: number;
  confirmed: number;
  completed: number;
  lostOrCancelled: number;
  actionToday: number;
  /** Sum only when verifiedRevenue is set on confirmed/completed leads. */
  realizedRevenue: number | null;
  conversionInquiryToQualified: number | null;
  conversionQualifiedToQuoteSent: number | null;
  conversionQuoteToConfirmed: number | null;
  note: string;
}
