import type { Attribution } from "@/lib/leads/types";

export interface InquiryPayload {
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
  /** Original customer message (defaults to notes). */
  message?: string;
  attribution?: Attribution;
  consentMarketing?: boolean;
  sourceHint?: string;
}

export interface StoredInquiry extends InquiryPayload {
  id: string;
  createdAt: string;
  emailSent: boolean;
  /** Linked CRM lead id when durable leads are enabled. */
  leadId?: string;
}
