import { whatsappUrl } from "@/lib/constants";
import type { InquiryPayload } from "@/lib/inquiry-types";

export function inquiryWhatsAppMessage(data: InquiryPayload): string {
  return [
    "Hello,",
    "",
    "I'd like to inquire about availability through Core Rentals TLV:",
    "",
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Phone: ${data.phone?.trim() || "—"}`,
    "",
    `Apartment: ${data.apartment?.trim() || "Any from catalog"}`,
    `Check-in: ${data.checkin?.trim() || "Flexible"}`,
    `Check-out: ${data.checkout?.trim() || "Flexible"}`,
    `Guests: ${data.guests?.trim() || "—"}`,
    "",
    "Notes:",
    data.notes?.trim() || "—",
  ].join("\n");
}

export function inquiryWhatsAppUrl(data: InquiryPayload): string {
  return whatsappUrl(inquiryWhatsAppMessage(data));
}
