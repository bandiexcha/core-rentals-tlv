import { SITE } from "@/lib/constants";
import { SITE_URL } from "@/lib/seo";
import type { CampaignMessage } from "@/lib/reconnect/types";

export const DEFAULT_RECONNECT_SUBJECT =
  "We’d Love to Welcome You Back to Tel Aviv!";

export const DEFAULT_EMAIL_BODY = `Hello!

It’s been a while, and I’d love to reconnect!

If you’re planning another visit to Tel Aviv, Core Rentals TLV would be delighted to welcome you back.

We offer beautiful, fully furnished apartments for short and extended stays — whether you’re visiting with family, friends, or for business.

Planning a trip to Tel Aviv? Just reply to this email or WhatsApp me directly.

Explore our apartments: ${SITE_URL}

Looking forward to hearing from you!

Warm regards,
Avishay Ben Eli
Core Rentals TLV
WhatsApp: +972 52-759-9399
Email: ${SITE.inquiryEmail}
Website: ${SITE_URL}

---
Core Rentals TLV · Tel Aviv, Israel
You received this because you previously stayed with or inquired about Core Rentals TLV / HolyGuest / SeaN'Rent accommodations.
To unsubscribe from future email updates, use the unsubscribe link in this message or reply with UNSUBSCRIBE.`;

export const DEFAULT_WHATSAPP_BODY = `Hello!

It’s been a while — I’d love to reconnect.

If you’re planning another visit to Tel Aviv, Core Rentals TLV would be delighted to welcome you back. We offer fully furnished apartments for short and extended stays (family, friends, or business).

Planning a trip? Reply here or WhatsApp +972 52-759-9399.

Explore: ${SITE_URL}

Warm regards,
Avishay Ben Eli
Core Rentals TLV
${SITE.inquiryEmail}

Reply STOP to opt out of WhatsApp updates from Core Rentals TLV.`;

export function defaultCampaignMessage(): CampaignMessage {
  return {
    subject: DEFAULT_RECONNECT_SUBJECT,
    bodyText: DEFAULT_EMAIL_BODY,
    bodyHtml: emailBodyToHtml(DEFAULT_EMAIL_BODY),
    whatsappText: DEFAULT_WHATSAPP_BODY,
    whatsappTemplateName: process.env.WHATSAPP_RECONNECT_TEMPLATE_NAME || "",
    whatsappTemplateLanguage:
      process.env.WHATSAPP_RECONNECT_TEMPLATE_LANG || "en",
  };
}

export function emailBodyToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const withLinks = escaped.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1">$1</a>'
  );
  return `<!DOCTYPE html><html><body style="font-family:Georgia,serif;line-height:1.5;color:#1a1a1a"><pre style="white-space:pre-wrap;font-family:Georgia,serif">${withLinks}</pre></body></html>`;
}

export function appendUnsubscribeFooter(
  bodyText: string,
  unsubscribeUrl: string
): string {
  if (bodyText.includes(unsubscribeUrl)) return bodyText;
  return `${bodyText}\n\nUnsubscribe: ${unsubscribeUrl}`;
}
