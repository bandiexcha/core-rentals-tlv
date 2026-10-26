export type PermissionStatus =
  | "unknown"
  | "legacy_customer"
  | "opted_in"
  | "opted_out";

export type ContactChannel = "email" | "whatsapp";

export type CampaignChannel = "email" | "whatsapp";

export type CampaignStatus =
  | "draft"
  | "test_sent"
  | "awaiting_approval"
  | "approved"
  | "running"
  | "paused"
  | "completed"
  | "cancelled";

export type DeliveryStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "bounced"
  | "replied"
  | "opted_out"
  | "skipped";

export interface ImportBatch {
  id: string;
  createdAt: string;
  fileName: string;
  fileType: string;
  channelHint: ContactChannel | "auto";
  totalRaw: number;
  imported: number;
  duplicates: number;
  rejected: number;
  notes: string[];
}

export interface DeliveryEvent {
  id: string;
  at: string;
  campaignId: string;
  channel: CampaignChannel;
  status: DeliveryStatus;
  provider?: string;
  providerMessageId?: string | null;
  error?: string;
  /** Only true when provider confirmed delivery. */
  providerConfirmed: boolean;
}

export interface ReconnectContact {
  id: string;
  /** Canonical email (lowercase) when this is an email-channel contact. */
  email?: string;
  /** E.164 phone when this is a WhatsApp-channel contact. */
  phoneE164?: string;
  /** Display name only when present in the source — never invented. */
  displayName?: string;
  channel: ContactChannel;
  permissionStatus: PermissionStatus;
  suppressed: boolean;
  suppressReason?: string;
  sources: Array<{
    importId: string;
    fileName: string;
    at: string;
  }>;
  /** Email seen in a WhatsApp screenshot — NOT treated as verified email identity. */
  emailMentionUnverified?: string;
  delivery: DeliveryEvent[];
  lastEmailedCampaignId?: string | null;
  lastWhatsappCampaignId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignMessage {
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  whatsappText: string;
  /** Meta-approved template name — required for live WhatsApp. */
  whatsappTemplateName?: string;
  whatsappTemplateLanguage?: string;
}

export interface CampaignCostEstimate {
  currency: string;
  unitEstimate: number | null;
  recipientCount: number;
  estimatedTotal: number | null;
  note: string;
  source: string;
}

export interface ReconnectCampaign {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  mode: "test" | "live";
  message: CampaignMessage;
  recipientContactIds: string[];
  eligibleCount: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  optedOutCount: number;
  skippedCount: number;
  repliedCount: number;
  /** Owner must set true before live launch. */
  ownerApproved: boolean;
  approvedAt?: string | null;
  approvedBy?: string;
  lawfulBasisAcknowledged: boolean;
  costEstimate: CampaignCostEstimate;
  actualCost: number | null;
  actualCostNote: string;
  batchSize: number;
  delayMs: number;
  lastError?: string;
  idempotencyPrefix: string;
}

export interface ReconnectStats {
  generatedAt: string;
  uniqueEmails: number;
  uniquePhones: number;
  emailEligible: number;
  whatsappEligible: number;
  emailSuppressed: number;
  whatsappSuppressed: number;
  importBatches: number;
  importedTotal: number;
  rejectedTotal: number;
  duplicateTotal: number;
  campaigns: Array<{
    id: string;
    name: string;
    channel: CampaignChannel;
    status: CampaignStatus;
    mode: "test" | "live";
    sentCount: number;
    deliveredCount: number;
    failedCount: number;
    optedOutCount: number;
  }>;
  whatsappIntegration: {
    status: "READY" | "BLOCKED" | "NOT_CONFIGURED";
    coexistenceNote: string;
    blockers: string[];
  };
  emailIntegration: {
    status: "READY" | "BLOCKED" | "PARTIAL";
    blockers: string[];
    senderIdentity: string;
  };
}
